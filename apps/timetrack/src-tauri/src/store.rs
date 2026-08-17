use crate::state::Db;
use crate::error::TimetrackResult;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
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
    pub cwd: Option<String>,
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
    pub day: String,
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
///
/// An observation dated inside a pause is refused here rather than by each collector. The collectors
/// that watch the machine are stopped while it is paused, but the ones that read history are not
/// bounded by when they run - a git scan reaches a day or a month back - so this is what keeps a
/// resume from collecting exactly the stretch the pause was taken to keep out.
#[tauri::command]
pub async fn events_append(
    db: State<'_, Db>,
    events: Vec<StoredEvent>,
    cursors: Vec<AgentSessionCursorRow>,
) -> TimetrackResult<i64> {
    db.run(move |connection| append(connection, &events, &cursors)).await
}

fn append(
    connection: &mut Connection,
    events: &[StoredEvent],
    cursors: &[AgentSessionCursorRow],
) -> TimetrackResult<i64> {
    let transaction = connection.transaction()?;
    let paused = crate::pause::pause_ranges(&transaction)?;
    let mut appended = 0i64;

    {
        let mut insert = transaction.prepare(
            "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (dedupe_key) DO NOTHING",
        )?;
        for event in events {
            if crate::pause::is_paused_at(&paused, event.at_ms) {
                continue;
            }

            appended += insert.execute(params![
                event.at_ms,
                event.source,
                event.kind,
                serde_json::to_string(&event.payload)?,
                event.dedupe_key
            ])? as i64;
        }

        let mut upsert = transaction.prepare(
            "INSERT INTO agent_session_cursor (id, next_line, after_ms, title, cwd)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (id) DO UPDATE SET next_line = ?2, after_ms = ?3, title = ?4, cwd = ?5",
        )?;
        for cursor in cursors {
            upsert.execute(params![
                cursor.id,
                cursor.next_line,
                cursor.after_ms,
                cursor.title,
                cursor.cwd
            ])?;
        }
    }

    transaction.commit()?;

    Ok(appended)
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
            connection.prepare("SELECT id, next_line, after_ms, title, cwd FROM agent_session_cursor")?;
        let rows = statement.query_map([], |row| {
            Ok(AgentSessionCursorRow {
                id: row.get(0)?,
                next_line: row.get(1)?,
                after_ms: row.get(2)?,
                title: row.get(3)?,
                cwd: row.get(4)?,
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

/// Everything this app owns on one local calendar day. By day rather than by proposal id: a worklog
/// whose proposal the day stopped producing is the one that has to be deleted, and no caller can name
/// it by id.
#[tauri::command]
pub async fn ledger_entries_for_day(db: State<'_, Db>, day: String) -> TimetrackResult<Vec<SyncedWorklogRow>> {
    db.run(move |connection| {
        let mut statement = connection.prepare(
            "SELECT proposal_id, day, tempo_worklog_id, content_hash, synced_at_ms FROM synced_worklog
             WHERE day = ?1",
        )?;
        let rows = statement.query_map(params![day], |row| {
            Ok(SyncedWorklogRow {
                proposal_id: row.get(0)?,
                day: row.get(1)?,
                tempo_worklog_id: row.get(2)?,
                content_hash: row.get(3)?,
                synced_at_ms: row.get(4)?,
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
                "INSERT INTO synced_worklog (proposal_id, day, tempo_worklog_id, content_hash, synced_at_ms)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (proposal_id) DO UPDATE SET
                   day = ?2, tempo_worklog_id = ?3, content_hash = ?4, synced_at_ms = ?5",
            )?;
            for entry in &entries {
                upsert.execute(params![
                    entry.proposal_id,
                    entry.day,
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

/// The settings document, or `None` while nothing has been configured. Passed through untouched: what
/// a setting means belongs to the core, and the host only has to keep it.
#[tauri::command]
pub async fn app_settings(db: State<'_, Db>) -> TimetrackResult<Option<serde_json::Value>> {
    db.run(move |connection| {
        let stored = connection
            .query_row("SELECT document FROM app_setting WHERE id = 1", [], |row| {
                row.get::<_, String>(0)
            })
            .optional()?;

        Ok(stored.and_then(|document| serde_json::from_str(&document).ok()))
    })
    .await
}

/// The one field of the settings document the host reads for itself: whether the window locks.
///
/// The shape of that document belongs to the core, so this reads a single optional flag and treats
/// anything it does not understand as the default. The host has to know before a view is mounted, which
/// is why it does not wait to be told.
pub async fn lock_window_setting(db: &Db) -> bool {
    let stored = db
        .run(move |connection| {
            Ok(connection
                .query_row("SELECT document FROM app_setting WHERE id = 1", [], |row| {
                    row.get::<_, String>(0)
                })
                .optional()?)
        })
        .await;

    let Ok(Some(document)) = stored else {
        return true;
    };

    serde_json::from_str::<serde_json::Value>(&document)
        .ok()
        .and_then(|document| document.get("lockWindow").and_then(serde_json::Value::as_bool))
        .unwrap_or(true)
}

#[tauri::command]
pub async fn set_app_settings(db: State<'_, Db>, settings: serde_json::Value) -> TimetrackResult<()> {
    db.run(move |connection| {
        connection.execute(
            "INSERT INTO app_setting (id, document) VALUES (1, ?1)
             ON CONFLICT (id) DO UPDATE SET document = ?1",
            params![serde_json::to_string(&settings)?],
        )?;

        Ok(())
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

/// What Tempo held for a day when the Sync preview last read it, or `None` for a day no preview has
/// covered. Passed through untouched, like the review edits: the host has no opinion about it.
#[tauri::command]
pub async fn tempo_coverage_for_day(db: State<'_, Db>, day: String) -> TimetrackResult<Option<serde_json::Value>> {
    db.run(move |connection| {
        let stored = connection
            .query_row("SELECT coverage FROM tempo_coverage WHERE day = ?1", params![day], |row| {
                row.get::<_, String>(0)
            })
            .optional()?;

        Ok(stored.and_then(|coverage| serde_json::from_str(&coverage).ok()))
    })
    .await
}

#[tauri::command]
pub async fn set_tempo_coverage(db: State<'_, Db>, day: String, coverage: serde_json::Value) -> TimetrackResult<()> {
    db.run(move |connection| {
        connection.execute(
            "INSERT INTO tempo_coverage (day, coverage) VALUES (?1, ?2)
             ON CONFLICT (day) DO UPDATE SET coverage = ?2",
            params![day, serde_json::to_string(&coverage)?],
        )?;

        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn store() -> Connection {
        let connection = Connection::open_in_memory().unwrap();

        db::migrate(&connection).unwrap();

        connection
    }

    fn commit(at_ms: i64) -> StoredEvent {
        StoredEvent {
            at_ms,
            source: "git".to_string(),
            kind: "git-commit".to_string(),
            payload: serde_json::json!({ "sha": format!("sha-{at_ms}") }),
            dedupe_key: Some(format!("git-commit:{at_ms}")),
        }
    }

    fn stored_at(connection: &Connection) -> Vec<i64> {
        let mut statement = connection
            .prepare("SELECT at_ms FROM collected_event WHERE source = 'git' ORDER BY at_ms")
            .unwrap();
        let rows = statement.query_map([], |row| row.get(0)).unwrap();

        rows.collect::<Result<Vec<_>, _>>().unwrap()
    }

    #[test]
    fn refuses_history_a_later_scan_read_out_of_a_pause() {
        let mut connection = store();

        crate::pause::write(&mut connection, true, 1_000).unwrap();
        crate::pause::write(&mut connection, false, 2_000).unwrap();

        let appended = append(&mut connection, &[commit(500), commit(1_500), commit(3_000)], &[]).unwrap();

        assert_eq!(appended, 2);
        assert_eq!(stored_at(&connection), vec![500, 3_000]);
    }

    #[test]
    fn keeps_moving_the_cursors_of_a_collector_whose_lines_a_pause_refused() {
        let mut connection = store();

        crate::pause::write(&mut connection, true, 1_000).unwrap();

        append(
            &mut connection,
            &[commit(1_500)],
            &[AgentSessionCursorRow {
                id: "session-a".to_string(),
                next_line: 42,
                after_ms: None,
                title: None,
                cwd: None,
            }],
        )
        .unwrap();

        assert_eq!(stored_at(&connection), Vec::<i64>::new());
        assert_eq!(
            connection
                .query_row("SELECT next_line FROM agent_session_cursor WHERE id = 'session-a'", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            42
        );
    }

    #[test]
    fn rewinds_a_cursor_and_forgets_what_it_last_read() {
        let mut connection = store();
        let cursor = |next_line: i64, after_ms: Option<i64>, title: Option<&str>| AgentSessionCursorRow {
            id: "session-a".to_string(),
            next_line,
            after_ms,
            title: title.map(str::to_string),
            cwd: Some("/home/tom/dev/fut-frontend".to_string()),
        };

        append(&mut connection, &[], &[cursor(42, Some(1_000), Some("a session"))]).unwrap();
        append(&mut connection, &[], &[cursor(0, None, None)]).unwrap();

        assert_eq!(
            connection
                .query_row(
                    "SELECT next_line, after_ms, title, cwd FROM agent_session_cursor WHERE id = 'session-a'",
                    [],
                    |row| Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, Option<i64>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?
                    ))
                )
                .unwrap(),
            (0, None, None, Some("/home/tom/dev/fut-frontend".to_string()))
        );
    }
}
