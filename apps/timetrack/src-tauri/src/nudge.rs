use crate::error::TimetrackResult;
use crate::state::Db;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_notification::NotificationExt;

/// What one day has already been reminded about. `None` on both fields is a day nothing has said
/// anything about yet, which is the same answer as no row at all.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DayNudgeRow {
    pub day: String,
    pub last_nudged_at_ms: Option<i64>,
    pub silenced_until_ms: Option<i64>,
}

fn read(connection: &Connection, day: &str) -> TimetrackResult<Option<DayNudgeRow>> {
    Ok(connection
        .query_row(
            "SELECT day, last_nudged_at_ms, silenced_until_ms FROM day_nudge WHERE day = ?1",
            params![day],
            |row| {
                Ok(DayNudgeRow {
                    day: row.get(0)?,
                    last_nudged_at_ms: row.get(1)?,
                    silenced_until_ms: row.get(2)?,
                })
            },
        )
        .optional()?)
}

/// Writes the row whole, exactly as the webview holds it. A field the caller left out is cleared
/// rather than kept: "not today" and "later" are the same field, and a merge would leave a day
/// silenced by a decision the user has since replaced.
fn write(connection: &Connection, row: &DayNudgeRow) -> TimetrackResult<()> {
    connection.execute(
        "INSERT INTO day_nudge (day, last_nudged_at_ms, silenced_until_ms) VALUES (?1, ?2, ?3)
         ON CONFLICT (day) DO UPDATE SET last_nudged_at_ms = ?2, silenced_until_ms = ?3",
        params![row.day, row.last_nudged_at_ms, row.silenced_until_ms],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn day_nudge_record(db: State<'_, Db>, day: String) -> TimetrackResult<Option<DayNudgeRow>> {
    db.run(move |connection| read(connection, &day)).await
}

#[tauri::command]
pub async fn set_day_nudge_record(db: State<'_, Db>, record: DayNudgeRow) -> TimetrackResult<()> {
    db.run(move |connection| write(connection, &record)).await
}

/// Puts one line in front of the user wherever they are, which is the whole reason the reminder exists:
/// closing the window hides it to the tray, so a banner nobody opens the app to see reminds nobody.
///
/// The plugin decides what a notification is on each desktop, and it posts as the terminal while the
/// app runs from `tauri dev` — an unbundled binary has no identity of its own to post under.
#[tauri::command]
pub async fn notify<R: Runtime>(app: AppHandle<R>, title: String, body: String) -> TimetrackResult<()> {
    app.notification().builder().title(title).body(body).show()?;

    Ok(())
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

    #[test]
    fn answers_nothing_for_a_day_nobody_was_reminded_about() {
        assert!(read(&store(), "2026-08-16").unwrap().is_none());
    }

    #[test]
    fn keeps_what_a_day_was_last_reminded_about() {
        let connection = store();

        write(
            &connection,
            &DayNudgeRow {
                day: "2026-08-16".into(),
                last_nudged_at_ms: Some(1_000),
                silenced_until_ms: None,
            },
        )
        .unwrap();

        let stored = read(&connection, "2026-08-16").unwrap().unwrap();

        assert_eq!(stored.last_nudged_at_ms, Some(1_000));
        assert_eq!(stored.silenced_until_ms, None);
    }

    #[test]
    fn replaces_the_row_rather_than_merging_into_it() {
        let connection = store();
        let row = |silenced| DayNudgeRow {
            day: "2026-08-16".into(),
            last_nudged_at_ms: Some(1_000),
            silenced_until_ms: silenced,
        };

        write(&connection, &row(Some(9_000))).unwrap();
        write(&connection, &row(None)).unwrap();

        assert_eq!(read(&connection, "2026-08-16").unwrap().unwrap().silenced_until_ms, None);
    }

    #[test]
    fn keeps_each_day_apart() {
        let connection = store();

        write(
            &connection,
            &DayNudgeRow {
                day: "2026-08-16".into(),
                last_nudged_at_ms: Some(1_000),
                silenced_until_ms: None,
            },
        )
        .unwrap();

        assert!(read(&connection, "2026-08-17").unwrap().is_none());
    }
}
