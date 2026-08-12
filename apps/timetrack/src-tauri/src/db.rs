use crate::error::{TimetrackError, TimetrackResult};
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

fn migrate(connection: &Connection) -> TimetrackResult<()> {
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
            3
        );
        assert_eq!(connection.execute(INSERT, params![1_i64, "git-commit:abc"]).unwrap(), 1);
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
