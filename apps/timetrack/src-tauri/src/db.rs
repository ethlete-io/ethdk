use crate::error::{TimetrackError, TimetrackResult};
use chrono::{DateTime, Local, TimeZone};
use rusqlite::Connection;
use std::path::Path;

const SCHEMA: &str = "
CREATE TABLE collected_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at_ms INTEGER NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX collected_event_at_ms ON collected_event (at_ms);

CREATE TABLE synced_worklog (
  proposal_id TEXT PRIMARY KEY,
  tempo_worklog_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  synced_at_ms INTEGER NOT NULL
);

CREATE TABLE agent_session_cursor (
  id TEXT PRIMARY KEY,
  next_line INTEGER NOT NULL,
  after_ms INTEGER,
  title TEXT
);

CREATE TABLE compaction (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  compacted_through_ms INTEGER
);
INSERT INTO compaction (id, compacted_through_ms) VALUES (1, NULL);
";

/// A day's review edits, keyed by its local calendar day. The whole `DayReviewEdits` is one JSON
/// document because it is always read and written whole, and its shape belongs to the core, not here.
const SCHEMA_V2: &str = "
CREATE TABLE day_review (
  day TEXT PRIMARY KEY,
  edits TEXT NOT NULL
);
";

/// The identity a re-collected event is recognised by, from the core's `dedupeKeyOf`. A git scan reads
/// a window of history rather than a stream, so overlapping runs see the same commits again and the
/// unique index is what drops the repeat. SQLite treats NULLs as distinct, so an event with no such
/// identity — a focus sample — is still always appended.
const SCHEMA_V3: &str = "
ALTER TABLE collected_event ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX collected_event_dedupe_key ON collected_event (dedupe_key);
";

/// The runs the user timed by hand. `stopped_at_ms IS NULL` is the one open run, and the index is what
/// makes "at most one" an invariant the database enforces rather than one the commands remember: two
/// open timers would each claim the same wall clock.
///
/// The index has to be over the expression rather than over `stopped_at_ms` itself. SQLite counts NULLs
/// as distinct from one another, so a unique index on a column that is NULL in every open row
/// constrains nothing at all.
const SCHEMA_V4: &str = "
CREATE TABLE timer_run (
  id TEXT PRIMARY KEY,
  started_at_ms INTEGER NOT NULL,
  stopped_at_ms INTEGER,
  issue_key TEXT,
  note TEXT
);
CREATE INDEX timer_run_started_at_ms ON timer_run (started_at_ms);
CREATE UNIQUE INDEX timer_run_open ON timer_run (stopped_at_ms IS NULL) WHERE stopped_at_ms IS NULL;
";

/// What the user configured, as one JSON document — the same arrangement as `day_review`, and for the
/// same reason: the shape belongs to the core, which reads and writes the whole thing. No secret is in
/// it; a token lives in the OS keychain.
const SCHEMA_V5: &str = "
CREATE TABLE app_setting (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  document TEXT NOT NULL
);
";

/// Whether the user has stopped collection, and since when.
///
/// It is a row rather than a field of the settings document because the host has to read it before the
/// webview exists: the samplers start during `setup`, and a pause that only took effect once the
/// window had loaded would collect the first seconds of every restart.
const SCHEMA_V6: &str = "
CREATE TABLE collection_pause (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  paused_at_ms INTEGER
);
INSERT INTO collection_pause (id, paused_at_ms) VALUES (1, NULL);
";

/// What a day has already been reminded about, so one unfinished day is reported once rather than at
/// every tick, and so "later" and "not today" survive a restart.
///
/// A row exists only for a day that was reminded about, and the retention pass never needs to reach it:
/// it is one short row per working day.
const SCHEMA_V7: &str = "
CREATE TABLE day_nudge (
  day TEXT PRIMARY KEY,
  last_nudged_at_ms INTEGER,
  silenced_until_ms INTEGER
);
";

/// The local calendar day a worklog this app owns sits on, so ownership can be read per day.
///
/// Reading it by proposal id can only ever return what the day still proposes, and a worklog whose
/// proposal is gone is exactly the one that has to be deleted from Tempo — so it read as somebody
/// else's work and stayed there.
const SCHEMA_V8: &str = "
ALTER TABLE synced_worklog ADD COLUMN day TEXT NOT NULL DEFAULT '';
CREATE INDEX synced_worklog_day ON synced_worklog (day);
";

/// What Tempo already held for a day, as the Sync preview last read it — one JSON document per day,
/// the same arrangement as `day_review` and for the same reason: it is read and written whole, and its
/// shape belongs to the core.
///
/// The ledger records only what this app wrote, so without this row a day the user logged in Tempo by
/// hand reads as a day nobody logged. The week view and the reminder have no token, so the preview is
/// the only thing that can ever fill it in.
const SCHEMA_V9: &str = "
CREATE TABLE tempo_coverage (
  day TEXT PRIMARY KEY,
  coverage TEXT NOT NULL
);
";

/// The checkout a session log was last read in, so a new project link can rewind exactly the logs it
/// covers.
///
/// A session carries no dedupe key, so rewinding a log that a link does not cover appends a second copy
/// of every sample in it. The column is what makes the choice per log rather than all or nothing. It is
/// NULL for every cursor written before this, and such a cursor is never rewound.
const SCHEMA_V10: &str = "
ALTER TABLE agent_session_cursor ADD COLUMN cwd TEXT;
";

/// Gives every ledger entry written before schema v8 its day.
///
/// A proposal id is `<issueKey>@<ISO instant>`, so the day is in the row already; a row whose id does
/// not parse falls back to when it was synced, which is the same day for every worklog this app has
/// ever written. An entry left without a day would be invisible to the per-day read, which is the very
/// failure v8 exists to close.
fn backfill_synced_worklog_days(connection: &Connection) -> TimetrackResult<()> {
    let mut statement = connection.prepare("SELECT proposal_id, synced_at_ms FROM synced_worklog WHERE day = ''")?;
    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    for (proposal_id, synced_at_ms) in rows {
        let day = day_of_proposal_id(&proposal_id).unwrap_or_else(|| local_day_of_ms(synced_at_ms));

        connection.execute(
            "UPDATE synced_worklog SET day = ?1 WHERE proposal_id = ?2",
            rusqlite::params![day, proposal_id],
        )?;
    }

    Ok(())
}

fn day_of_proposal_id(proposal_id: &str) -> Option<String> {
    let (_, instant) = proposal_id.rsplit_once('@')?;

    DateTime::parse_from_rfc3339(instant)
        .ok()
        .map(|at| at.with_timezone(&Local).format("%Y-%m-%d").to_string())
}

fn local_day_of_ms(at_ms: i64) -> String {
    Local
        .timestamp_millis_opt(at_ms)
        .single()
        .map(|at| at.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

/// Opens the encrypted database at `path`, creating and migrating it on first run.
///
/// `key` is the 64 hex chars from the keychain. `PRAGMA key` has to be the first statement on the
/// connection — anything before it is executed against an unkeyed database and permanently confuses
/// SQLCipher about the file's header.
pub fn open(path: &Path, key: &str) -> TimetrackResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;

    connection.execute_batch(&format!("PRAGMA key = \"x'{key}'\";"))?;
    connection
        .query_row("SELECT count(*) FROM sqlite_master", [], |row| row.get::<_, i64>(0))
        .map_err(|_| {
            TimetrackError::Rejected(
                "the database could not be decrypted with the key in the keychain".into(),
            )
        })?;
    connection.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;

    migrate(&connection)?;

    Ok(connection)
}

pub fn migrate(connection: &Connection) -> TimetrackResult<()> {
    let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version < 1 {
        connection.execute_batch(SCHEMA)?;
        connection.pragma_update(None, "user_version", 1)?;
    }

    if version < 2 {
        connection.execute_batch(SCHEMA_V2)?;
        connection.pragma_update(None, "user_version", 2)?;
    }

    if version < 3 {
        connection.execute_batch(SCHEMA_V3)?;
        connection.pragma_update(None, "user_version", 3)?;
    }

    if version < 4 {
        connection.execute_batch(SCHEMA_V4)?;
        connection.pragma_update(None, "user_version", 4)?;
    }

    if version < 5 {
        connection.execute_batch(SCHEMA_V5)?;
        connection.pragma_update(None, "user_version", 5)?;
    }

    if version < 6 {
        connection.execute_batch(SCHEMA_V6)?;
        connection.pragma_update(None, "user_version", 6)?;
    }

    if version < 7 {
        connection.execute_batch(SCHEMA_V7)?;
        connection.pragma_update(None, "user_version", 7)?;
    }

    if version < 8 {
        connection.execute_batch(SCHEMA_V8)?;
        backfill_synced_worklog_days(connection)?;
        connection.pragma_update(None, "user_version", 8)?;
    }

    if version < 9 {
        connection.execute_batch(SCHEMA_V9)?;
        connection.pragma_update(None, "user_version", 9)?;
    }

    if version < 10 {
        connection.execute_batch(SCHEMA_V10)?;
        connection.pragma_update(None, "user_version", 10)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    const INSERT: &str =
        "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key)
         VALUES (?1, 'git', 'git-commit', '{}', ?2) ON CONFLICT (dedupe_key) DO NOTHING";

    fn migrated_from(version: i64) -> Connection {
        let connection = Connection::open_in_memory().unwrap();

        if version >= 1 {
            connection.execute_batch(SCHEMA).unwrap();
        }

        if version >= 2 {
            connection.execute_batch(SCHEMA_V2).unwrap();
        }

        if version >= 3 {
            connection.execute_batch(SCHEMA_V3).unwrap();
        }

        if version >= 4 {
            connection.execute_batch(SCHEMA_V4).unwrap();
        }

        if version >= 5 {
            connection.execute_batch(SCHEMA_V5).unwrap();
        }

        if version >= 6 {
            connection.execute_batch(SCHEMA_V6).unwrap();
        }

        if version >= 7 {
            connection.execute_batch(SCHEMA_V7).unwrap();
        }

        if version >= 8 {
            connection.execute_batch(SCHEMA_V8).unwrap();
        }

        if version >= 9 {
            connection.execute_batch(SCHEMA_V9).unwrap();
        }

        connection.pragma_update(None, "user_version", version).unwrap();
        migrate(&connection).unwrap();

        connection
    }

    fn count(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT count(*) FROM collected_event", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn migrates_a_database_that_predates_the_dedupe_key() {
        let connection = migrated_from(2);

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            10
        );
        assert_eq!(connection.execute(INSERT, params![1_i64, "git-commit:abc"]).unwrap(), 1);
    }

    #[test]
    fn leaves_a_cursor_written_before_the_checkout_column_without_one() {
        let connection = migrated_from(9);

        connection
            .execute("INSERT INTO agent_session_cursor (id, next_line) VALUES ('s1', 42)", [])
            .unwrap();

        assert_eq!(
            connection
                .query_row("SELECT cwd FROM agent_session_cursor WHERE id = 's1'", [], |row| row
                    .get::<_, Option<String>>(0))
                .unwrap(),
            None
        );
    }

    #[test]
    fn gives_a_database_that_predates_the_coverage_table_one() {
        let connection = migrated_from(8);

        connection
            .execute(
                "INSERT INTO tempo_coverage (day, coverage) VALUES ('2026-08-11', '{}')",
                [],
            )
            .unwrap();

        assert_eq!(
            connection
                .query_row("SELECT coverage FROM tempo_coverage WHERE day = '2026-08-11'", [], |row| {
                    row.get::<_, String>(0)
                })
                .unwrap(),
            "{}"
        );
    }

    /// A database that stops at v7, so the row is inserted into the ledger as it was before the day.
    fn ledger_day_after_migrating(proposal_id: &str, synced_at_ms: i64) -> String {
        let connection = Connection::open_in_memory().unwrap();

        for schema in [SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7] {
            connection.execute_batch(schema).unwrap();
        }

        connection.pragma_update(None, "user_version", 7).unwrap();
        connection
            .execute(
                "INSERT INTO synced_worklog (proposal_id, tempo_worklog_id, content_hash, synced_at_ms)
                 VALUES (?1, 'w1', 'h', ?2)",
                params![proposal_id, synced_at_ms],
            )
            .unwrap();
        migrate(&connection).unwrap();

        connection
            .query_row("SELECT day FROM synced_worklog", [], |row| row.get(0))
            .unwrap()
    }

    #[test]
    fn gives_a_ledger_entry_written_before_the_day_column_the_day_its_proposal_names() {
        let at = DateTime::parse_from_rfc3339("2026-08-11T07:00:00.000Z").unwrap();
        let day = ledger_day_after_migrating("FIP-3010@2026-08-11T07:00:00.000Z", 0);

        assert_eq!(day, local_day_of_ms(at.timestamp_millis()));
        assert_ne!(day, local_day_of_ms(0));
    }

    #[test]
    fn falls_back_to_when_a_ledger_entry_was_synced_when_its_proposal_id_says_nothing() {
        assert_eq!(ledger_day_after_migrating("hand-written", 0), local_day_of_ms(0));
    }

    #[test]
    fn migrates_a_database_that_predates_the_pause() {
        let connection = migrated_from(5);

        assert_eq!(
            connection
                .query_row("SELECT paused_at_ms FROM collection_pause WHERE id = 1", [], |row| row
                    .get::<_, Option<i64>>(0))
                .unwrap(),
            None
        );
    }

    #[test]
    fn migrates_a_database_that_predates_the_settings() {
        let connection = migrated_from(4);

        connection
            .execute("INSERT INTO app_setting (id, document) VALUES (1, '{}')", [])
            .unwrap();
        assert!(connection
            .execute("INSERT INTO app_setting (id, document) VALUES (2, '{}')", [])
            .is_err());
    }

    #[test]
    fn migrates_a_database_that_predates_the_reminder() {
        let connection = migrated_from(6);

        connection
            .execute("INSERT INTO day_nudge (day, last_nudged_at_ms) VALUES ('2026-08-16', 1)", [])
            .unwrap();
        assert!(connection
            .execute("INSERT INTO day_nudge (day, last_nudged_at_ms) VALUES ('2026-08-16', 2)", [])
            .is_err());
    }

    #[test]
    fn migrates_a_database_that_predates_the_timer() {
        let connection = migrated_from(3);

        connection
            .execute("INSERT INTO timer_run (id, started_at_ms) VALUES ('a', 1)", [])
            .unwrap();
        assert_eq!(
            connection
                .query_row("SELECT count(*) FROM timer_run", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }

    #[test]
    fn refuses_a_second_open_timer_run() {
        let connection = migrated_from(0);

        connection
            .execute("INSERT INTO timer_run (id, started_at_ms) VALUES ('a', 1)", [])
            .unwrap();
        assert!(connection
            .execute("INSERT INTO timer_run (id, started_at_ms) VALUES ('b', 2)", [])
            .is_err());
    }

    #[test]
    fn takes_a_second_run_once_the_first_one_stopped() {
        let connection = migrated_from(0);

        connection
            .execute("INSERT INTO timer_run (id, started_at_ms, stopped_at_ms) VALUES ('a', 1, 2)", [])
            .unwrap();
        connection
            .execute("INSERT INTO timer_run (id, started_at_ms, stopped_at_ms) VALUES ('b', 3, 4)", [])
            .unwrap();
        connection
            .execute("INSERT INTO timer_run (id, started_at_ms) VALUES ('c', 5)", [])
            .unwrap();
    }

    #[test]
    fn appends_a_keyed_event_once_however_often_it_is_rescanned() {
        let connection = migrated_from(0);

        connection.execute(INSERT, params![1_i64, "git-commit:abc"]).unwrap();
        assert_eq!(connection.execute(INSERT, params![9_i64, "git-commit:abc"]).unwrap(), 0);
        assert_eq!(count(&connection), 1);
    }

    #[test]
    fn keeps_appending_observations_that_have_no_identity() {
        let connection = migrated_from(0);

        connection.execute(INSERT, params![1_i64, None::<String>]).unwrap();
        connection.execute(INSERT, params![1_i64, None::<String>]).unwrap();

        assert_eq!(count(&connection), 2);
    }
}
