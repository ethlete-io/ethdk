use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

use crate::tools::{checks_dir, flattened};

const SUFFIX: &str = ".status.json";

/// Where `et design status` keeps the state of one call. `statusPath` in
/// `libs/cli/src/lib/design/status.ts` builds the same name; both sides must agree.
pub fn status_path(checkout: &str, call: &str) -> PathBuf {
    checks_dir().join(format!("{}{SUFFIX}", flattened(&format!("{checkout} {call}"))))
}

/// The state the tooling last recorded for one call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CallStatus {
    pub state: String,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

fn read_status(path: &Path) -> Option<CallStatus> {
    serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

/// The recorded state of each named call. A call nothing recorded a state for is left out.
#[tauri::command]
pub fn design_statuses(checkout: String, slugs: Vec<String>) -> BTreeMap<String, CallStatus> {
    slugs
        .into_iter()
        .filter_map(|slug| read_status(&status_path(&checkout, &slug)).map(|status| (slug, status)))
        .collect()
}

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
    fn a_status_path_flattens_the_checkout_and_the_call_like_the_cli() {
        let path = status_path("/home/tom/dev/sdk", "app/01-one");

        assert_eq!(path.parent(), Some(checks_dir().as_path()));
        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some("-home-tom-dev-sdk-app-01-one.status.json")
        );
    }

    #[test]
    fn statuses_read_back_only_the_calls_that_have_one() {
        let checkout = format!("/tmp/ethlete-studio-{}-statuses", std::process::id());
        let path = status_path(&checkout, "app/one");

        std::fs::create_dir_all(checks_dir()).unwrap();
        std::fs::write(
            &path,
            r#"{"state":"failed","updatedAt":"2026-10-23T13:00:00.000Z","message":"TYPE ERROR"}"#,
        )
        .unwrap();

        let read = design_statuses(checkout, vec!["app/one".to_owned(), "app/two".to_owned()]);

        assert_eq!(read.keys().collect::<Vec<_>>(), ["app/one"]);
        assert_eq!(read["app/one"].state, "failed");
        assert_eq!(read["app/one"].message.as_deref(), Some("TYPE ERROR"));

        std::fs::remove_file(&path).unwrap();
    }

    #[test]
    fn a_written_status_is_reported_and_a_receipt_is_not() {
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

        std::fs::write(dir.join("a-call.status.json"), "{}").unwrap();
        assert!(count_after(&count, Duration::from_secs(5)) > 0, "a status is reported");

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
