use std::path::Path;
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::ipc::Channel;
use tauri::State;

use crate::design::{calls_root, read_config};

/// The watch one window armed. A window reads one checkout at a time, so the host keeps one
/// watcher, and arming it again replaces the one before it.
#[derive(Default)]
pub struct DesignWatch(Mutex<Option<RecommendedWatcher>>);

/// Reports every change under `root`, and every change under a folder created inside it later.
fn watch_root(root: &Path, report: impl Fn() + Send + 'static) -> Result<RecommendedWatcher, String> {
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        // Reading a call file is not a change to it, and the design server reads every one of them.
        if event.is_ok_and(|event| !event.kind.is_access()) {
            report();
        }
    })
    .map_err(|error| format!("Unable to watch for design changes: {error}"))?;

    watcher
        .watch(root, RecursiveMode::Recursive)
        .map_err(|error| format!("Unable to watch {}: {error}", root.to_string_lossy()))?;

    Ok(watcher)
}

/// Reports every change under the checkout's calls root, so a call an agent or an editor wrote
/// outside the window reaches its list without a reload.
///
/// The watch before it is dropped first: `notify` releases its kernel watches when it goes, and two
/// live watches over one root would report every change twice.
#[tauri::command]
pub fn design_watch(state: State<'_, DesignWatch>, checkout: String, changes: Channel<()>) -> Result<(), String> {
    let config = read_config(&checkout)?;
    let root = calls_root(&checkout, &config)?;
    let mut slot = state.0.lock().map_err(|_| "The design watch is poisoned.".to_owned())?;

    *slot = None;
    *slot = Some(watch_root(&root, move || {
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

    /// Waits for the watch to report, which takes as long as the kernel and `notify` need.
    fn reported(count: &AtomicUsize) -> bool {
        let deadline = Instant::now() + Duration::from_secs(5);

        while Instant::now() < deadline {
            if count.load(Ordering::SeqCst) > 0 {
                return true;
            }

            std::thread::sleep(Duration::from_millis(20));
        }

        false
    }

    #[test]
    fn a_call_written_in_a_new_folder_is_reported() {
        let root = std::env::temp_dir().join(format!("ethlete-studio-{}-watch", std::process::id()));
        let feature = root.join("kerbe");

        std::fs::create_dir_all(&feature).unwrap();

        let count = Arc::new(AtomicUsize::new(0));
        let seen = count.clone();
        let _watcher = watch_root(&root, move || {
            seen.fetch_add(1, Ordering::SeqCst);
        })
        .unwrap();

        let call = feature.join("09-gutter");

        std::fs::create_dir_all(&call).unwrap();
        std::fs::write(call.join("call.ts"), "export default {};").unwrap();

        assert!(reported(&count), "a new call folder is reported");

        std::fs::remove_dir_all(&root).unwrap();
    }
}
