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

/// Splits the session-log cursors by the pass that wrote them, so the spend backfill of ADR 0003 can
/// read a log from the top without moving the collector's own offset.
///
/// SQLite cannot widen a primary key in place, so the table is rebuilt. Every existing row belongs to
/// the collector, because the backfill has never run. `read_through_ms` is what says a log has been
/// read to its end: an empty log leaves `next_line` at 0, and the pass would otherwise read it for ever.
///
/// The leading drop is the one edit this migration may take. A store stranded by the non-atomic run it
/// once had kept the half-built table and never reached v11, so every later start failed here; the drop
/// is what lets such a store migrate. A store that finished v11 never runs this again, and a store that
/// has not started it has no such table, so neither sees the drop at all.
const SCHEMA_V11: &str = "
DROP TABLE IF EXISTS agent_session_cursor_next;
CREATE TABLE agent_session_cursor_next (
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  next_line INTEGER NOT NULL,
  after_ms INTEGER,
  title TEXT,
  cwd TEXT,
  read_through_ms INTEGER,
  PRIMARY KEY (id, kind)
);
INSERT INTO agent_session_cursor_next (id, kind, next_line, after_ms, title, cwd)
  SELECT id, 'agent-session', next_line, after_ms, title, cwd FROM agent_session_cursor;
DROP TABLE agent_session_cursor;
ALTER TABLE agent_session_cursor_next RENAME TO agent_session_cursor;
";

/// Carries a parser's per-log session state, for a log format that states it once rather than on
/// every record.
///
/// Codex writes the model on a turn boundary and the session id on a header record, so a read that
/// resumes mid-turn has neither. The host never interprets the JSON: the format lives in the parser.
const SCHEMA_V13: &str = "
ALTER TABLE agent_session_cursor ADD COLUMN session_json TEXT;
";

/// Drops the repeats a keyless sample left behind.
///
/// The host holds a focus, presence or microphone sample until the collector acknowledges it, and the
/// acknowledged sequence lives in the webview, so every reload drained the whole buffer again. Those
/// samples carried no dedupe key, so each drain appended a second copy: one real day held 346 rows
/// whose `at_ms`, source, kind and payload were already stored. `dedupeKeyOf` keys them now, which
/// stops the next one; this clears what is stored already.
///
/// Only a keyless row is touched, and only where an earlier row is identical in all four columns. Two
/// such rows cannot be told apart by any reader, so keeping the lower id loses nothing.
const SCHEMA_V14: &str = "
DELETE FROM collected_event WHERE dedupe_key IS NULL AND EXISTS (
  SELECT 1 FROM collected_event AS earlier
  WHERE earlier.dedupe_key IS NULL
    AND earlier.at_ms = collected_event.at_ms
    AND earlier.source = collected_event.source
    AND earlier.kind = collected_event.kind
    AND earlier.payload = collected_event.payload
    AND earlier.id < collected_event.id
);
";

/// Repairs a store whose v11 ran before `read_through_ms` was part of it.
///
/// The column was added to `SCHEMA_V11` after that migration had already run on real stores, and a
/// store at v11 never runs it again — so a store can sit at v11 either with the column or without it,
/// and the one without it fails every read of the table. The check is what makes v12 right for both.
/// Never edit a migration that has run; add the next one.
fn add_read_through_ms(connection: &Connection) -> TimetrackResult<()> {
    let present = connection
        .prepare("SELECT 1 FROM pragma_table_info('agent_session_cursor') WHERE name = 'read_through_ms'")?
        .exists([])?;

    if !present {
        connection.execute_batch("ALTER TABLE agent_session_cursor ADD COLUMN read_through_ms INTEGER;")?;
    }

    Ok(())
}

/// The shape `agent_session_cursor` must have, whatever a store's history did to it.
const CURSOR_COLUMNS: [&str; 8] = [
    "id",
    "kind",
    "next_line",
    "after_ms",
    "title",
    "cwd",
    "read_through_ms",
    "session_json",
];

const CURSOR_TABLE: &str = "
CREATE TABLE agent_session_cursor_repair (
  id TEXT NOT NULL,
  kind TEXT NOT NULL,
  next_line INTEGER NOT NULL,
  after_ms INTEGER,
  title TEXT,
  cwd TEXT,
  read_through_ms INTEGER,
  session_json TEXT,
  PRIMARY KEY (id, kind)
);
";

/// Rebuilds `agent_session_cursor` whenever a column of `CURSOR_COLUMNS` is missing, whatever left it
/// that way.
///
/// v12 repaired one known shape by its one missing column, and a store has since turned up at v11 or
/// later with no `kind` at all, which fails every write the collector makes. Repairing against the
/// shape rather than against a version number covers the one store nobody predicted as well.
///
/// A missing column is filled with what v11 would have written: the collector's pass for `kind`, and
/// nothing for a column that carries no value of its own.
fn repair_agent_session_cursor(connection: &Connection) -> TimetrackResult<()> {
    let mut statement = connection.prepare("SELECT name FROM pragma_table_info('agent_session_cursor')")?;
    let held = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    drop(statement);

    if CURSOR_COLUMNS
        .iter()
        .all(|column| held.iter().any(|name| name == column))
    {
        return Ok(());
    }

    let carried = CURSOR_COLUMNS
        .iter()
        .map(|column| {
            if held.iter().any(|name| name == column) {
                (*column).to_owned()
            } else {
                match *column {
                    "kind" => "'agent-session'".to_owned(),
                    "next_line" => "0".to_owned(),
                    _ => "NULL".to_owned(),
                }
            }
        })
        .collect::<Vec<_>>()
        .join(", ");

    connection.execute_batch(&format!(
        "{CURSOR_TABLE}
         INSERT INTO agent_session_cursor_repair ({columns}) SELECT {carried} FROM agent_session_cursor;
         DROP TABLE agent_session_cursor;
         ALTER TABLE agent_session_cursor_repair RENAME TO agent_session_cursor;",
        columns = CURSOR_COLUMNS.join(", "),
    ))?;

    Ok(())
}

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
            TimetrackError::Rejected("the database could not be decrypted with the key in the keychain".into())
        })?;
    connection.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;

    migrate(&connection)?;

    Ok(connection)
}

/// Applies one migration step and its version bump as one unit.
///
/// `execute_batch` is not atomic. A batch that fails half way leaves the statements before the failure
/// applied and the version unbumped, so the next start runs the same step against a store that is
/// already part way through it. v11 creates a table, so that re-run fails on a table it created itself,
/// for ever, and only deleting the store gets the app back.
fn step<F>(connection: &Connection, version: i64, apply: F) -> TimetrackResult<()>
where
    F: FnOnce(&Connection) -> TimetrackResult<()>,
{
    connection.execute_batch("BEGIN")?;

    let applied = apply(connection).and_then(|()| {
        connection.pragma_update(None, "user_version", version)?;
        Ok(())
    });

    match applied {
        Ok(()) => {
            connection.execute_batch("COMMIT")?;
            Ok(())
        }
        Err(error) => {
            connection.execute_batch("ROLLBACK")?;
            Err(error)
        }
    }
}

pub fn migrate(connection: &Connection) -> TimetrackResult<()> {
    let version: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version < 1 {
        step(connection, 1, |connection| Ok(connection.execute_batch(SCHEMA)?))?;
    }

    if version < 2 {
        step(connection, 2, |connection| Ok(connection.execute_batch(SCHEMA_V2)?))?;
    }

    if version < 3 {
        step(connection, 3, |connection| Ok(connection.execute_batch(SCHEMA_V3)?))?;
    }

    if version < 4 {
        step(connection, 4, |connection| Ok(connection.execute_batch(SCHEMA_V4)?))?;
    }

    if version < 5 {
        step(connection, 5, |connection| Ok(connection.execute_batch(SCHEMA_V5)?))?;
    }

    if version < 6 {
        step(connection, 6, |connection| Ok(connection.execute_batch(SCHEMA_V6)?))?;
    }

    if version < 7 {
        step(connection, 7, |connection| Ok(connection.execute_batch(SCHEMA_V7)?))?;
    }

    if version < 8 {
        step(connection, 8, |connection| {
            connection.execute_batch(SCHEMA_V8)?;
            backfill_synced_worklog_days(connection)
        })?;
    }

    if version < 9 {
        step(connection, 9, |connection| Ok(connection.execute_batch(SCHEMA_V9)?))?;
    }

    if version < 10 {
        step(connection, 10, |connection| Ok(connection.execute_batch(SCHEMA_V10)?))?;
    }

    if version < 11 {
        step(connection, 11, |connection| Ok(connection.execute_batch(SCHEMA_V11)?))?;
    }

    if version < 12 {
        step(connection, 12, add_read_through_ms)?;
    }

    if version < 13 {
        step(connection, 13, |connection| Ok(connection.execute_batch(SCHEMA_V13)?))?;
    }

    if version < 14 {
        step(connection, 14, |connection| Ok(connection.execute_batch(SCHEMA_V14)?))?;
    }

    if version < 15 {
        step(connection, 15, repair_agent_session_cursor)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    const INSERT: &str = "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key)
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

        if version >= 10 {
            connection.execute_batch(SCHEMA_V10).unwrap();
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
            15
        );
        assert_eq!(connection.execute(INSERT, params![1_i64, "git-commit:abc"]).unwrap(), 1);
    }

    const FOCUS: &str = "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key)
         VALUES (?1, 'window', 'window-focus', ?2, NULL)";

    /// A store at v13 holds the repeats every webview reload appended while a buffered sample carried
    /// no key, so the migration has to reach a store that is already migrated.
    fn stored_at_v13() -> Connection {
        let connection = Connection::open_in_memory().unwrap();

        migrate(&connection).unwrap();
        connection.pragma_update(None, "user_version", 13).unwrap();

        connection
    }

    #[test]
    fn drops_a_keyless_row_an_identical_earlier_one_already_covers() {
        let connection = stored_at_v13();

        for _ in 0..3 {
            connection
                .execute(FOCUS, params![1_000_i64, r#"{"appId":"code","title":"db.rs"}"#])
                .unwrap();
        }

        connection
            .execute(FOCUS, params![2_000_i64, r#"{"appId":"code","title":"db.rs"}"#])
            .unwrap();
        connection
            .execute(
                FOCUS,
                params![1_000_i64, r#"{"appId":"google-chrome","title":"db.rs"}"#],
            )
            .unwrap();

        migrate(&connection).unwrap();

        assert_eq!(count(&connection), 3);
        assert_eq!(
            connection
                .query_row(
                    "SELECT count(*) FROM collected_event WHERE at_ms = 1000 AND payload LIKE '%code%'",
                    [],
                    |row| row.get::<_, i64>(0)
                )
                .unwrap(),
            1
        );
    }

    #[test]
    fn leaves_a_keyed_row_alone_even_when_another_matches_it_column_for_column() {
        let connection = stored_at_v13();

        connection
            .execute(INSERT, params![1_000_i64, "git-commit:abc"])
            .unwrap();
        connection
            .execute(INSERT, params![1_000_i64, "git-commit:def"])
            .unwrap();

        migrate(&connection).unwrap();

        assert_eq!(count(&connection), 2);
    }

    /// The store on a machine that ran v11 before the column was part of it. Every read of the table
    /// failed there, so the repair has to reach a store already at v11.
    #[test]
    fn gives_a_cursor_table_that_stopped_at_the_pass_column_the_read_through_column() {
        let connection = Connection::open_in_memory().unwrap();

        for schema in [
            SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9, SCHEMA_V10,
        ] {
            connection.execute_batch(schema).unwrap();
        }

        connection
            .execute_batch(
                "DROP TABLE agent_session_cursor;
                 CREATE TABLE agent_session_cursor (
                   id TEXT NOT NULL,
                   kind TEXT NOT NULL,
                   next_line INTEGER NOT NULL,
                   after_ms INTEGER,
                   title TEXT,
                   cwd TEXT,
                   PRIMARY KEY (id, kind)
                 );
                 INSERT INTO agent_session_cursor (id, kind, next_line) VALUES ('s1', 'agent-session', 42);",
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 11).unwrap();

        migrate(&connection).unwrap();

        assert_eq!(
            connection
                .query_row(
                    "SELECT read_through_ms FROM agent_session_cursor WHERE id = 's1'",
                    [],
                    |row| row.get::<_, Option<i64>>(0)
                )
                .unwrap(),
            None
        );
    }

    /// The same repair on a store whose v11 already carried the column, which must not fail.
    #[test]
    fn leaves_a_cursor_table_that_already_has_the_read_through_column_alone() {
        let connection = migrated_from(9);

        migrate(&connection).unwrap();

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            15
        );
    }

    #[test]
    fn leaves_a_cursor_written_before_the_session_state_column_without_one() {
        let connection = migrated_from(9);

        connection
            .execute(
                "INSERT INTO agent_session_cursor (id, kind, next_line) VALUES ('s1', 'agent-session', 42)",
                [],
            )
            .unwrap();

        assert_eq!(
            connection
                .query_row(
                    "SELECT session_json FROM agent_session_cursor WHERE id = 's1'",
                    [],
                    |row| row.get::<_, Option<String>>(0)
                )
                .unwrap(),
            None
        );
    }

    #[test]
    fn leaves_a_cursor_written_before_the_checkout_column_without_one() {
        let connection = migrated_from(9);

        connection
            .execute(
                "INSERT INTO agent_session_cursor (id, kind, next_line) VALUES ('s1', 'agent-session', 42)",
                [],
            )
            .unwrap();

        assert_eq!(
            connection
                .query_row("SELECT cwd FROM agent_session_cursor WHERE id = 's1'", [], |row| row
                    .get::<_, Option<
                    String,
                >>(
                    0
                ))
                .unwrap(),
            None
        );
    }

    #[test]
    fn gives_a_cursor_written_before_the_pass_column_the_collector_as_its_pass() {
        let connection = Connection::open_in_memory().unwrap();

        for schema in [
            SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9, SCHEMA_V10,
        ] {
            connection.execute_batch(schema).unwrap();
        }

        connection
            .execute(
                "INSERT INTO agent_session_cursor (id, next_line, cwd) VALUES ('s1', 42, '/repo')",
                [],
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 10).unwrap();

        migrate(&connection).unwrap();

        assert_eq!(
            connection
                .query_row(
                    "SELECT kind, next_line, cwd FROM agent_session_cursor WHERE id = 's1'",
                    [],
                    |row| Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?
                    ))
                )
                .unwrap(),
            ("agent-session".to_string(), 42, "/repo".to_string())
        );
    }

    #[test]
    fn keeps_the_two_passes_over_one_log_apart() {
        let connection = migrated_from(10);

        for kind in ["agent-session", "spend"] {
            connection
                .execute(
                    "INSERT INTO agent_session_cursor (id, kind, next_line) VALUES ('s1', ?1, 7)",
                    params![kind],
                )
                .unwrap();
        }

        assert_eq!(
            connection
                .query_row("SELECT count(*) FROM agent_session_cursor WHERE id = 's1'", [], |row| {
                    row.get::<_, i64>(0)
                })
                .unwrap(),
            2
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
                .query_row(
                    "SELECT coverage FROM tempo_coverage WHERE day = '2026-08-11'",
                    [],
                    |row| { row.get::<_, String>(0) }
                )
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
                .query_row("SELECT paused_at_ms FROM collection_pause WHERE id = 1", [], |row| {
                    row.get::<_, Option<i64>>(0)
                })
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
            .execute(
                "INSERT INTO day_nudge (day, last_nudged_at_ms) VALUES ('2026-08-16', 1)",
                [],
            )
            .unwrap();
        assert!(connection
            .execute(
                "INSERT INTO day_nudge (day, last_nudged_at_ms) VALUES ('2026-08-16', 2)",
                []
            )
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
            .execute(
                "INSERT INTO timer_run (id, started_at_ms, stopped_at_ms) VALUES ('a', 1, 2)",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO timer_run (id, started_at_ms, stopped_at_ms) VALUES ('b', 3, 4)",
                [],
            )
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

    /// A store built up to v10 and then stamped past v11 without v11 ever rebuilding its table. A build
    /// made from a working tree left one like it, and every write the collector made there failed with
    /// "table agent_session_cursor has no column named kind" until the store was deleted by hand.
    #[test]
    fn repairs_a_cursor_table_a_later_version_left_without_the_pass_column() {
        let connection = Connection::open_in_memory().unwrap();

        for schema in [
            SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9, SCHEMA_V10,
        ] {
            connection.execute_batch(schema).unwrap();
        }

        connection
            .execute(
                "INSERT INTO agent_session_cursor (id, next_line, after_ms, title, cwd)
                 VALUES ('s1', 42, 7, 'a title', '/repo')",
                [],
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 14).unwrap();

        migrate(&connection).unwrap();

        assert_eq!(
            connection
                .query_row(
                    "SELECT kind, next_line, after_ms, title, cwd, read_through_ms, session_json
                     FROM agent_session_cursor WHERE id = 's1'",
                    [],
                    |row| Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, Option<i64>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, Option<i64>>(5)?,
                        row.get::<_, Option<String>>(6)?,
                    ))
                )
                .unwrap(),
            (
                "agent-session".to_string(),
                42,
                Some(7),
                Some("a title".to_string()),
                Some("/repo".to_string()),
                None,
                None
            )
        );

        connection
            .execute(
                "INSERT INTO agent_session_cursor (id, kind, next_line) VALUES ('s1', 'spend', 0)",
                [],
            )
            .unwrap();
    }

    /// A step that fails part way through must leave nothing of itself behind. Without that, v11's own
    /// `agent_session_cursor_next` survived the failure, the version stayed at 10, and every later start
    /// failed on a table v11 had created itself.
    #[test]
    fn leaves_nothing_behind_when_a_migration_step_fails_part_way() {
        let connection = Connection::open_in_memory().unwrap();

        for schema in [
            SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9, SCHEMA_V10,
        ] {
            connection.execute_batch(schema).unwrap();
        }

        connection
            .execute("INSERT INTO agent_session_cursor (id, next_line) VALUES (NULL, 42)", [])
            .unwrap();
        connection.pragma_update(None, "user_version", 10).unwrap();

        assert!(migrate(&connection).is_err());

        assert_eq!(
            connection
                .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            10
        );
        assert!(!connection
            .prepare("SELECT 1 FROM sqlite_master WHERE name = 'agent_session_cursor_next'")
            .unwrap()
            .exists([])
            .unwrap());
    }
}
