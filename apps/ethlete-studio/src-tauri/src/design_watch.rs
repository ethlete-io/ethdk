use std::path::Path;
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::ipc::Channel;
use tauri::State;

use crate::design::{read_config, DESIGN_DIR};

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

/// Reports every change under the checkout's design folder, so a call or a design-system entry an
/// agent or an editor wrote outside the window reaches its list without a reload.
///
/// The watch before it is dropped first: `notify` releases its kernel watches when it goes, and two
/// live watches over one root would report every change twice.
#[tauri::command]
pub fn design_watch(state: State<'_, DesignWatch>, checkout: String, changes: Channel<()>) -> Result<(), String> {
    arm(&state, &checkout, move || {
        let _ = changes.send(());
    })
}

/// The watch before is dropped even when the new checkout cannot be watched, so a window that
/// moved on never hears from the checkout it left.
fn arm(watch: &DesignWatch, checkout: &str, report: impl Fn() + Send + 'static) -> Result<(), String> {
    let mut slot = watch.0.lock().map_err(|_| "The design watch is poisoned.".to_owned())?;

    *slot = None;
    read_config(checkout)?;
    *slot = Some(watch_root(&Path::new(checkout).join(DESIGN_DIR), report)?);

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
    fn arming_a_checkout_without_a_config_stops_the_watch_before() {
        let base = std::env::temp_dir().join(format!("ethlete-studio-{}-rearm", std::process::id()));
        let first = base.join("first");
        let second = base.join("second");
        let calls = crate::design::calls_root(&first.to_string_lossy());

        std::fs::create_dir_all(&calls).unwrap();
        std::fs::create_dir_all(&second).unwrap();
        std::fs::write(first.join(crate::design::DESIGN_DIR).join("config.json"), "{}").unwrap();

        let watch = DesignWatch::default();
        let count = Arc::new(AtomicUsize::new(0));
        let seen = count.clone();

        arm(&watch, &first.to_string_lossy(), move || {
            seen.fetch_add(1, Ordering::SeqCst);
        })
        .unwrap();

        assert!(arm(&watch, &second.to_string_lossy(), || {}).is_err());
        assert!(watch.0.lock().unwrap().is_none(), "the first checkout's watch is gone");

        std::fs::remove_dir_all(&base).unwrap();
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

    #[test]
    fn a_change_to_a_design_system_entry_is_reported() {
        let checkout = std::env::temp_dir().join(format!("ethlete-studio-{}-system", std::process::id()));
        let design = checkout.join(DESIGN_DIR);
        let entry = design.join("system").join("app").join("card");

        std::fs::create_dir_all(&entry).unwrap();
        std::fs::create_dir_all(crate::design::calls_root(&checkout.to_string_lossy())).unwrap();
        std::fs::write(design.join("config.json"), "{}").unwrap();

        let watch = DesignWatch::default();
        let count = Arc::new(AtomicUsize::new(0));
        let seen = count.clone();

        arm(&watch, &checkout.to_string_lossy(), move || {
            seen.fetch_add(1, Ordering::SeqCst);
        })
        .unwrap();
        std::fs::write(entry.join("entry.md"), "A card.").unwrap();

        assert!(reported(&count));

        drop(watch);
        let _ = std::fs::remove_dir_all(&checkout);
    }
}
