use crate::error::TimetrackResult;
use crate::ingest::IngestSource;
use crate::state::Db;
use crate::window::WindowSource;
use chrono::SecondsFormat;
use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

/// What the review reads a paused stretch back out of. It is an ordinary presence transition, so the
/// sessionizer already ends a block at it and the gap filler already refuses to fill across it.
const PAUSE_SOURCE: &str = "idle";
const PAUSE_START: &str = "pause-start";
const PAUSE_END: &str = "pause-end";

/// Whether collection is stopped, and since when. `None` is collecting.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionState {
    pub paused_at_ms: Option<i64>,
}

pub fn paused_at(connection: &Connection) -> TimetrackResult<Option<i64>> {
    Ok(connection.query_row("SELECT paused_at_ms FROM collection_pause WHERE id = 1", [], |row| {
        row.get(0)
    })?)
}

/// The `CollectedEvent` the core will read back, as its own JSON. The host stores whole events rather
/// than columns, so a pause has to be written in the shape the webview revives.
fn pause_event(at_ms: i64, kind: &str) -> TimetrackResult<String> {
    let at = chrono::DateTime::from_timestamp_millis(at_ms)
        .ok_or_else(|| crate::error::TimetrackError::Rejected("the pause was dated outside any clock".into()))?
        .to_rfc3339_opts(SecondsFormat::Millis, true);

    Ok(serde_json::to_string(&serde_json::json!({
        "at": at,
        "source": PAUSE_SOURCE,
        "kind": kind,
    }))?)
}

/// Records the transition and moves the row in one transaction, and answers what the row now holds.
///
/// The two cannot be separated. A pause the collectors respect but nothing recorded is a hole the day
/// bridges and bills; a record with nothing stopped is time the app claims it did not watch.
pub(crate) fn write(connection: &mut Connection, paused: bool, at_ms: i64) -> TimetrackResult<Option<i64>> {
    let transaction = connection.transaction()?;
    let current = paused_at(&transaction)?;

    if current.is_some() == paused {
        return Ok(current);
    }

    // A resume is never dated before the pause it ends: the webview's clock can be behind the one that
    // started it, across a suspend or a manual change, and a backwards window would be nonsense.
    let at_ms = current.map_or(at_ms, |started| at_ms.max(started));

    transaction.execute(
        "INSERT INTO collected_event (at_ms, source, kind, payload, dedupe_key) VALUES (?1, ?2, ?3, ?4, NULL)",
        params![
            at_ms,
            PAUSE_SOURCE,
            if paused { PAUSE_START } else { PAUSE_END },
            pause_event(at_ms, if paused { PAUSE_START } else { PAUSE_END })?
        ],
    )?;
    transaction.execute(
        "UPDATE collection_pause SET paused_at_ms = ?1 WHERE id = 1",
        params![paused.then_some(at_ms)],
    )?;
    transaction.commit()?;

    Ok(paused.then_some(at_ms))
}

/// Every stretch collection was stopped for, as `(from_ms, to_ms)`. An open pause runs to the end of
/// time, because nothing has ended it yet.
///
/// This exists for the collectors that read *history* rather than watch the machine - a git scan reads
/// a day or a month back, so without it the first scan after a resume would collect the very commits
/// the pause was taken to keep out, and a pause would only ever delay collection rather than stop it.
pub fn pause_ranges(connection: &Connection) -> TimetrackResult<Vec<(i64, i64)>> {
    let mut statement = connection.prepare(
        "SELECT at_ms, kind FROM collected_event
         WHERE source = ?1 AND kind IN (?2, ?3) ORDER BY at_ms ASC, id ASC",
    )?;
    let rows = statement
        .query_map(params![PAUSE_SOURCE, PAUSE_START, PAUSE_END], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut ranges = Vec::new();
    let mut opened: Option<i64> = None;

    for (at_ms, kind) in rows {
        if kind == PAUSE_START {
            opened.get_or_insert(at_ms);
            continue;
        }

        if let Some(from) = opened.take() {
            ranges.push((from, at_ms));
        }
    }

    if let Some(from) = opened {
        ranges.push((from, i64::MAX));
    }

    Ok(ranges)
}

/// Whether an observation falls inside a pause, and so may not be stored however it was collected.
pub fn is_paused_at(ranges: &[(i64, i64)], at_ms: i64) -> bool {
    ranges.iter().any(|(from, to)| at_ms >= *from && at_ms <= *to)
}

#[tauri::command]
pub async fn collection_state(db: State<'_, Db>) -> TimetrackResult<CollectionState> {
    let paused_at_ms = db.run(|connection| paused_at(connection)).await?;

    Ok(CollectionState { paused_at_ms })
}

/// Stops or starts every collector on this machine, and records which it was.
///
/// The order is what keeps a sample from ever being dated inside a recorded pause: the source stops
/// **before** the pause is written and starts **after** the resume is written. A write that fails puts
/// the source back where it was, so a failed pause leaves the app collecting rather than collecting
/// with nothing to say so.
#[tauri::command]
pub async fn collection_set_paused(
    db: State<'_, Db>,
    windows: State<'_, WindowSource>,
    reporters: State<'_, IngestSource>,
    paused: bool,
    at_ms: i64,
) -> TimetrackResult<CollectionState> {
    let windows = windows.inner().clone();
    let reporters = reporters.inner().clone();
    let was = windows.is_paused();
    let apply = |paused: bool| {
        windows.set_paused(paused);
        reporters.set_paused(paused);
    };

    if paused {
        apply(true);
    }

    match db.run(move |connection| write(connection, paused, at_ms)).await {
        Ok(paused_at_ms) => {
            apply(paused_at_ms.is_some());

            Ok(CollectionState { paused_at_ms })
        }
        Err(error) => {
            apply(was);

            Err(error)
        }
    }
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

    fn events(connection: &Connection) -> Vec<(i64, String, String)> {
        let mut statement = connection
            .prepare("SELECT at_ms, kind, payload FROM collected_event ORDER BY id")
            .unwrap();
        let rows = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .unwrap();

        rows.collect::<Result<Vec<_>, _>>().unwrap()
    }

    #[test]
    fn records_the_pause_and_the_resume_as_events() {
        let mut connection = store();

        write(&mut connection, true, 1_000).unwrap();
        write(&mut connection, false, 5_000).unwrap();

        let stored = events(&connection);

        assert_eq!(stored.len(), 2);
        assert_eq!(stored[0].1, PAUSE_START);
        assert_eq!(stored[1].1, PAUSE_END);
        assert_eq!(stored[1].0, 5_000);
    }

    #[test]
    fn writes_the_event_in_the_shape_the_webview_revives() {
        let mut connection = store();

        write(&mut connection, true, 1_700_000_000_000).unwrap();

        let payload: serde_json::Value = serde_json::from_str(&events(&connection)[0].2).unwrap();

        assert_eq!(payload["source"], "idle");
        assert_eq!(payload["kind"], "pause-start");
        assert_eq!(payload["at"], "2023-11-14T22:13:20.000Z");
    }

    #[test]
    fn holds_the_instant_the_pause_started() {
        let mut connection = store();

        write(&mut connection, true, 1_000).unwrap();

        assert_eq!(paused_at(&connection).unwrap(), Some(1_000));

        write(&mut connection, false, 5_000).unwrap();

        assert_eq!(paused_at(&connection).unwrap(), None);
    }

    #[test]
    fn records_nothing_for_a_pause_that_is_already_paused() {
        let mut connection = store();

        write(&mut connection, true, 1_000).unwrap();
        write(&mut connection, true, 9_000).unwrap();

        assert_eq!(events(&connection).len(), 1);
        assert_eq!(paused_at(&connection).unwrap(), Some(1_000));
    }

    #[test]
    fn records_nothing_for_a_resume_that_is_already_collecting() {
        let mut connection = store();

        write(&mut connection, false, 1_000).unwrap();

        assert!(events(&connection).is_empty());
    }

    #[test]
    fn reports_each_pause_as_a_range_history_may_not_be_stored_in() {
        let mut connection = store();

        write(&mut connection, true, 1_000).unwrap();
        write(&mut connection, false, 2_000).unwrap();
        write(&mut connection, true, 5_000).unwrap();
        write(&mut connection, false, 9_000).unwrap();

        let ranges = pause_ranges(&connection).unwrap();

        assert_eq!(ranges, vec![(1_000, 2_000), (5_000, 9_000)]);
        assert!(is_paused_at(&ranges, 1_500));
        assert!(!is_paused_at(&ranges, 3_000));
        assert!(is_paused_at(&ranges, 7_000));
    }

    #[test]
    fn runs_a_pause_nobody_resumed_to_the_end_of_time() {
        let mut connection = store();

        write(&mut connection, true, 1_000).unwrap();

        let ranges = pause_ranges(&connection).unwrap();

        assert_eq!(ranges, vec![(1_000, i64::MAX)]);
        assert!(is_paused_at(&ranges, 9_999_999));
    }

    #[test]
    fn never_dates_a_resume_before_the_pause_it_ends() {
        let mut connection = store();

        write(&mut connection, true, 5_000).unwrap();
        write(&mut connection, false, 1_000).unwrap();

        assert_eq!(events(&connection)[1].0, 5_000);
    }
}
