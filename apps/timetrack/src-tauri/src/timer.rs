use crate::error::TimetrackResult;
use crate::state::Db;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use tauri::State;

/// A run as the webview reads it. `stoppedAtMs` absent means the run is still going.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerRunRow {
    pub id: String,
    pub started_at_ms: i64,
    pub stopped_at_ms: Option<i64>,
    pub issue_key: Option<String>,
    pub note: Option<String>,
}

const COLUMNS: &str = "id, started_at_ms, stopped_at_ms, issue_key, note";

fn to_row(row: &Row<'_>) -> rusqlite::Result<TimerRunRow> {
    Ok(TimerRunRow {
        id: row.get(0)?,
        started_at_ms: row.get(1)?,
        stopped_at_ms: row.get(2)?,
        issue_key: row.get(3)?,
        note: row.get(4)?,
    })
}

fn open_run(connection: &Connection) -> TimetrackResult<Option<TimerRunRow>> {
    Ok(connection
        .query_row(
            &format!("SELECT {COLUMNS} FROM timer_run WHERE stopped_at_ms IS NULL"),
            [],
            to_row,
        )
        .optional()?)
}

/// Closes the open run, if there is one, and reports it.
///
/// A run is never closed before it started: the clock the webview passes can be behind the one that
/// started the run, across a suspend or a manual clock change, and a negative span would be summed
/// into a day as if it were real.
fn close_open_run(connection: &Connection, at_ms: i64) -> TimetrackResult<Option<TimerRunRow>> {
    let Some(run) = open_run(connection)? else {
        return Ok(None);
    };
    let stopped_at_ms = at_ms.max(run.started_at_ms);

    connection.execute(
        "UPDATE timer_run SET stopped_at_ms = ?2 WHERE id = ?1",
        params![run.id, stopped_at_ms],
    )?;

    Ok(Some(TimerRunRow {
        stopped_at_ms: Some(stopped_at_ms),
        ..run
    }))
}

/// Runs overlapping the range, open ones included, in start order.
#[tauri::command]
pub async fn timer_runs_between(db: State<'_, Db>, from_ms: i64, to_ms: i64) -> TimetrackResult<Vec<TimerRunRow>> {
    db.run(move |connection| {
        let mut statement = connection.prepare(&format!(
            "SELECT {COLUMNS} FROM timer_run
             WHERE started_at_ms < ?2 AND (stopped_at_ms IS NULL OR stopped_at_ms > ?1)
             ORDER BY started_at_ms"
        ))?;
        let runs = statement
            .query_map(params![from_ms, to_ms], to_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(runs)
    })
    .await
}

#[tauri::command]
pub async fn timer_running(db: State<'_, Db>) -> TimetrackResult<Option<TimerRunRow>> {
    db.run(move |connection| open_run(connection)).await
}

/// Starts a run, closing whichever one was still going at the same instant.
///
/// Closing first is what keeps two runs from claiming the same wall clock. The database refuses a
/// second open run outright, so getting this wrong would be an error rather than a silent overlap.
#[tauri::command]
pub async fn timer_start(db: State<'_, Db>, at_ms: i64) -> TimetrackResult<TimerRunRow> {
    db.run(move |connection| {
        let transaction = connection.transaction()?;

        close_open_run(&transaction, at_ms)?;

        let id = format!("timer-{at_ms}-{:08x}", rand::random::<u32>());

        transaction.execute(
            "INSERT INTO timer_run (id, started_at_ms) VALUES (?1, ?2)",
            params![id, at_ms],
        )?;
        transaction.commit()?;

        Ok(TimerRunRow {
            id,
            started_at_ms: at_ms,
            stopped_at_ms: None,
            issue_key: None,
            note: None,
        })
    })
    .await
}

#[tauri::command]
pub async fn timer_stop(db: State<'_, Db>, at_ms: i64) -> TimetrackResult<Option<TimerRunRow>> {
    db.run(move |connection| close_open_run(connection, at_ms)).await
}

/// Names what a run was for. An empty string clears the field, which is how a mistyped key is undone.
#[tauri::command]
pub async fn timer_label(
    db: State<'_, Db>,
    id: String,
    issue_key: String,
    note: String,
) -> TimetrackResult<()> {
    db.run(move |connection| {
        let blank = |value: String| if value.trim().is_empty() { None } else { Some(value) };

        connection.execute(
            "UPDATE timer_run SET issue_key = ?2, note = ?3 WHERE id = ?1",
            params![id, blank(issue_key), blank(note)],
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

    fn start(connection: &mut Connection, at_ms: i64) -> String {
        let transaction = connection.transaction().unwrap();

        close_open_run(&transaction, at_ms).unwrap();

        let id = format!("run-{at_ms}");

        transaction
            .execute(
                "INSERT INTO timer_run (id, started_at_ms) VALUES (?1, ?2)",
                params![id, at_ms],
            )
            .unwrap();
        transaction.commit().unwrap();

        id
    }

    #[test]
    fn reports_the_run_that_is_still_going() {
        let mut connection = store();
        let id = start(&mut connection, 1_000);

        assert_eq!(open_run(&connection).unwrap().unwrap().id, id);
    }

    #[test]
    fn closes_the_previous_run_when_a_new_one_starts() {
        let mut connection = store();
        let first = start(&mut connection, 1_000);

        start(&mut connection, 5_000);

        let stopped: Option<i64> = connection
            .query_row(
                "SELECT stopped_at_ms FROM timer_run WHERE id = ?1",
                params![first],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(stopped, Some(5_000));
    }

    #[test]
    fn never_stops_a_run_before_it_started() {
        let mut connection = store();

        start(&mut connection, 5_000);

        assert_eq!(close_open_run(&connection, 1_000).unwrap().unwrap().stopped_at_ms, Some(5_000));
    }

    #[test]
    fn stops_nothing_when_no_timer_is_going() {
        let connection = store();

        assert!(close_open_run(&connection, 1_000).unwrap().is_none());
    }
}
