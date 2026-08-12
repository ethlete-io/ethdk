use crate::state::Db;
use crate::error::TimetrackResult;
use rusqlite::{params, params_from_iter, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

/// A raw observation as it is persisted. `payload` is the whole `CollectedEvent` the core produced;
/// `atMs`, `source` and `kind` are lifted out of it so a range query and a per-source retention pass
/// never have to parse JSON. Nothing here interprets an event — exclusion already ran in the core.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredEvent {
    pub at_ms: i64,
    pub source: String,
    pub kind: String,
    pub payload: serde_json::Value,
    /// What the core's `dedupeKeyOf` made of the event, so a rescan of the same history appends
    /// nothing. `None` for an observation that has no identity beyond having been made.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dedupe_key: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionCursorRow {
    pub id: String,
    pub next_line: i64,
    pub after_ms: Option<i64>,
    pub title: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTally {
    pub source: String,
    pub count: i64,
    pub latest_at_ms: Option<i64>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedWorklogRow {
    pub proposal_id: String,
    pub tempo_worklog_id: String,
    pub content_hash: String,
    pub synced_at_ms: i64,
}

fn placeholders(count: usize) -> String {
    std::iter::repeat_n("?", count).collect::<Vec<_>>().join(",")
}

#[tauri::command]
pub async fn events_between(db: State<'_, Db>, from_ms: i64, to_ms: i64) -> TimetrackResult<Vec<StoredEvent>> {
    db.run(move |connection| {
        let mut statement = connection.prepare(
            "SELECT at_ms, source, kind, payload FROM collected_event
             WHERE at_ms >= ?1 AND at_ms < ?2 ORDER BY at_ms ASC, id ASC",
        )?;
        let rows = statement.query_map(params![from_ms, to_ms], |row| {
            Ok(StoredEvent {
                at_ms: row.get(0)?,
                source: row.get(1)?,
                kind: row.get(2)?,
                payload: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(serde_json::Value::Null),
                dedupe_key: None,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
    .await
}

/// Appends what a collector produced and moves its cursors in the same transaction.
///
/// The two must commit together: a cursor that goes missing re-reads its log from the top and
/// appends every sample in it a second time.
///
/// An event whose `dedupe_key` is already stored is skipped rather than inserted, which is what lets
/// the git collector rescan a window it has already read. The count that comes back is the rows that
/// were new, so a collector can report what it actually added instead of what it looked at.
#[tauri::command]
pub async fn events_append(
    db: State<'_, Db>,
    events: Vec<StoredEvent>,
    cursors: Vec<AgentSessionCursorRow>,
) -> TimetrackResult<i64> {
    db.run(move |connection| {
        let transaction = connection.transaction()?;
        let mut appended = 0i64;

        {
            let mut insert = transaction.prepare(
                "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (dedupe_key) DO NOTHING",
            )?;
            for event in &events {
                appended += insert.execute(params![
                    event.at_ms,
                    event.source,
                    event.kind,
                    serde_json::to_string(&event.payload)?,
                    event.dedupe_key
                ])? as i64;
            }

            let mut upsert = transaction.prepare(
                "INSERT INTO agent_session_cursor (id, next_line, after_ms, title)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (id) DO UPDATE SET next_line = ?2, after_ms = ?3, title = ?4",
            )?;
            for cursor in &cursors {
                upsert.execute(params![cursor.id, cursor.next_line, cursor.after_ms, cursor.title])?;
            }
        }

        transaction.commit()?;

        Ok(appended)
    })
    .await
}

#[tauri::command]
pub async fn events_delete_before(db: State<'_, Db>, before_ms: i64) -> TimetrackResult<i64> {
    db.run(move |connection| {
        let deleted = connection.execute("DELETE FROM collected_event WHERE at_ms < ?1", params![before_ms])?;

        Ok(deleted as i64)
    })
    .await
}

/// What each collector has actually put in the store, and when it last managed to.
///
/// This is the only honest answer to "is this source collecting?". A per-session tally reads zero
/// after every reload, and a collector whose last run stored nothing looks identical to one that has
/// stopped — a frozen `latest_at_ms` does not.
#[tauri::command]
pub async fn events_by_source(db: State<'_, Db>) -> TimetrackResult<Vec<SourceTally>> {
    db.run(|connection| {
        let mut statement = connection.prepare(
            "SELECT source, count(*), max(at_ms) FROM collected_event GROUP BY source ORDER BY source",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(SourceTally {
                source: row.get(0)?,
                count: row.get(1)?,
                latest_at_ms: row.get(2)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
    .await
}

#[tauri::command]
pub async fn events_oldest_at(db: State<'_, Db>) -> TimetrackResult<Option<i64>> {
    db.run(|connection| {
        Ok(connection.query_row("SELECT min(at_ms) FROM collected_event", [], |row| row.get(0))?)
    })
    .await
}

#[tauri::command]
pub async fn agent_session_cursors(db: State<'_, Db>) -> TimetrackResult<Vec<AgentSessionCursorRow>> {
    db.run(|connection| {
        let mut statement =
            connection.prepare("SELECT id, next_line, after_ms, title FROM agent_session_cursor")?;
        let rows = statement.query_map([], |row| {
            Ok(AgentSessionCursorRow {
                id: row.get(0)?,
                next_line: row.get(1)?,
                after_ms: row.get(2)?,
                title: row.get(3)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
    .await
}

/// How far compaction has got, which is what clamps retention: blocks are what outlive the events,
/// so deleting a day nothing has compacted yet destroys it.
#[tauri::command]
pub async fn compacted_through(db: State<'_, Db>) -> TimetrackResult<Option<i64>> {
    db.run(|connection| {
        Ok(connection.query_row("SELECT compacted_through_ms FROM compaction WHERE id = 1", [], |row| {
            row.get(0)
        })?)
    })
    .await
}

#[tauri::command]
pub async fn set_compacted_through(db: State<'_, Db>, through_ms: Option<i64>) -> TimetrackResult<()> {
    db.run(move |connection| {
        connection.execute(
            "UPDATE compaction SET compacted_through_ms = ?1 WHERE id = 1",
            params![through_ms],
        )?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn ledger_entries_for(
    db: State<'_, Db>,
    proposal_ids: Vec<String>,
) -> TimetrackResult<Vec<SyncedWorklogRow>> {
    if proposal_ids.is_empty() {
        return Ok(Vec::new());
    }

    db.run(move |connection| {
        let sql = format!(
            "SELECT proposal_id, tempo_worklog_id, content_hash, synced_at_ms FROM synced_worklog
             WHERE proposal_id IN ({})",
            placeholders(proposal_ids.len())
        );
        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(params_from_iter(proposal_ids.iter()), |row| {
            Ok(SyncedWorklogRow {
                proposal_id: row.get(0)?,
                tempo_worklog_id: row.get(1)?,
                content_hash: row.get(2)?,
                synced_at_ms: row.get(3)?,
            })
        })?;

        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
    .await
}

#[tauri::command]
pub async fn ledger_upsert(db: State<'_, Db>, entries: Vec<SyncedWorklogRow>) -> TimetrackResult<()> {
    db.run(move |connection| {
        let transaction = connection.transaction()?;

        {
            let mut upsert = transaction.prepare(
                "INSERT INTO synced_worklog (proposal_id, tempo_worklog_id, content_hash, synced_at_ms)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (proposal_id) DO UPDATE SET
                   tempo_worklog_id = ?2, content_hash = ?3, synced_at_ms = ?4",
            )?;
            for entry in &entries {
                upsert.execute(params![
                    entry.proposal_id,
                    entry.tempo_worklog_id,
                    entry.content_hash,
                    entry.synced_at_ms
                ])?;
            }
        }

        transaction.commit()?;

        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn ledger_remove(db: State<'_, Db>, proposal_ids: Vec<String>) -> TimetrackResult<()> {
    if proposal_ids.is_empty() {
        return Ok(());
    }

    db.run(move |connection| {
        let sql = format!(
            "DELETE FROM synced_worklog WHERE proposal_id IN ({})",
            placeholders(proposal_ids.len())
        );
        connection.execute(&sql, params_from_iter(proposal_ids.iter()))?;

        Ok(())
    })
    .await
}

/// A day's review edits as stored, or `None` for a day nobody has edited. The JSON is passed through
/// untouched: the host has no opinion about what a reviewer changed.
#[tauri::command]
pub async fn day_review_edits(db: State<'_, Db>, day: String) -> TimetrackResult<Option<serde_json::Value>> {
    db.run(move |connection| {
        let stored = connection
            .query_row("SELECT edits FROM day_review WHERE day = ?1", params![day], |row| {
                row.get::<_, String>(0)
            })
            .optional()?;

        Ok(stored.and_then(|edits| serde_json::from_str(&edits).ok()))
    })
    .await
}

#[tauri::command]
pub async fn set_day_review_edits(
    db: State<'_, Db>,
    day: String,
    edits: Option<serde_json::Value>,
) -> TimetrackResult<()> {
    db.run(move |connection| {
        match edits {
            None => {
                connection.execute("DELETE FROM day_review WHERE day = ?1", params![day])?;
            }
            Some(edits) => {
                connection.execute(
                    "INSERT INTO day_review (day, edits) VALUES (?1, ?2)
                     ON CONFLICT (day) DO UPDATE SET edits = ?2",
                    params![day, serde_json::to_string(&edits)?],
                )?;
            }
        }

        Ok(())
    })
    .await
}

