use std::path::Path;
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::ipc::Channel;
use tauri::State;

use crate::tools::checks_dir;

const SUFFIX: &str = ".status.json";

/// The watch over the status folder one window armed. Arming it again replaces the one before it.
#[derive(Default)]
pub struct StatusWatch(Mutex<Option<RecommendedWatcher>>);

fn is_status(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(SUFFIX))
}

fn watch_statuses(dir: &Path, report: impl Fn() + Send + 'static) -> Result<RecommendedWatcher, String> {
    std::fs::create_dir_all(dir).map_err(|error| format!("Unable to create {}: {error}", dir.to_string_lossy()))?;

    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_ok_and(|event| !event.kind.is_access() && event.paths.iter().any(|path| is_status(path))) {
            report();
        }
    })
    .map_err(|error| format!("Unable to watch for call states: {error}"))?;

    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|error| format!("Unable to watch {}: {error}", dir.to_string_lossy()))?;

    Ok(watcher)
}

/// Reports every change to a recorded call state, so the list shows it without a reload.
#[tauri::command]
pub fn design_status_watch(state: State<'_, StatusWatch>, changes: Channel<()>) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|_| "The status watch is poisoned.".to_owned())?;

    *slot = None;
    *slot = Some(watch_statuses(&checks_dir(), move || {
        let _ = changes.send(());
    })?);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    fn count_after(count: &AtomicUsize, wait: Duration) -> usize {
        let deadline = Instant::now() + wait;

        while Instant::now() < deadline && count.load(Ordering::SeqCst) == 0 {
            std::thread::sleep(Duration::from_millis(20));
        }

        count.load(Ordering::SeqCst)
    }

    #[test]
    fn a_sketch_report_change_is_reported_and_a_receipt_is_not() {
        let dir = std::env::temp_dir().join(format!("ethlete-studio-{}-status-watch", std::process::id()));
        let count = Arc::new(AtomicUsize::new(0));
        let seen = count.clone();
        let _watcher = watch_statuses(&dir, move || {
            seen.fetch_add(1, Ordering::SeqCst);
        })
        .unwrap();

        std::fs::write(dir.join("a-receipt.json"), "{}").unwrap();
        assert_eq!(
            count_after(&count, Duration::from_millis(300)),
            0,
            "a receipt is not a status"
        );

        std::fs::write(dir.join("a-sketch.status.json"), "{}").unwrap();
        assert!(count_after(&count, Duration::from_secs(5)) > 0, "a status is reported");

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
