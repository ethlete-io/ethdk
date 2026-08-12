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

    Ok(())
}
