use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

use crate::call_status::checks_dir;
use crate::design_roots::{add_root, DesignRoots};
use crate::error::StudioResult;

const REQUEST_SUFFIX: &str = ".open.json";
const REPLY_SUFFIX: &str = ".opened.json";

#[derive(Deserialize)]
struct Request {
    checkout: String,
}

#[derive(Serialize)]
struct Reply {
    ok: bool,
    message: String,
}

/// The watch over the request folder one window armed. Arming it again replaces the one before it.
#[derive(Default)]
pub struct OpenWatch(Mutex<Option<RecommendedWatcher>>);

fn is_request(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(REQUEST_SUFFIX))
}

/// Answers one `et design studio open` request: keeps the checkout, writes the reply the cli polls for and
/// drops the request. Answers the checkout to show, or nothing when the request was refused, is gone or is
/// not fully written yet.
fn answer(request: &Path, add: impl Fn(&str) -> StudioResult<DesignRoots>) -> Option<String> {
    let parsed: Request = serde_json::from_str(&std::fs::read_to_string(request).ok()?).ok()?;
    let outcome = add(&parsed.checkout);
    let reply = Reply {
        ok: outcome.is_ok(),
        message: outcome.as_ref().err().map(ToString::to_string).unwrap_or_default(),
    };
    let name = request.file_name()?.to_str()?.strip_suffix(REQUEST_SUFFIX)?.to_owned();
    let reply_path: PathBuf = request.with_file_name(format!("{name}{REPLY_SUFFIX}"));

    std::fs::write(reply_path, serde_json::to_string(&reply).ok()?).ok()?;
    let _ = std::fs::remove_file(request);

    outcome.ok().map(|_| parsed.checkout)
}

fn pending(dir: &Path) -> Vec<PathBuf> {
    std::fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| is_request(path))
                .collect()
        })
        .unwrap_or_default()
}

fn watch_requests(
    dir: &Path,
    add: impl Fn(&str) -> StudioResult<DesignRoots> + Send + 'static,
    show: impl Fn(String) + Send + 'static,
) -> Result<RecommendedWatcher, String> {
    std::fs::create_dir_all(dir).map_err(|error| format!("Unable to create {}: {error}", dir.to_string_lossy()))?;

    for request in pending(dir) {
        if let Some(checkout) = answer(&request, &add) {
            show(checkout);
        }
    }

    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };

        if event.kind.is_access() || event.kind.is_remove() {
            return;
        }

        for path in event.paths.iter().filter(|path| is_request(path)) {
            if let Some(checkout) = answer(path, &add) {
                show(checkout);
            }
        }
    })
    .map_err(|error| format!("Unable to watch for open requests: {error}"))?;

    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|error| format!("Unable to watch {}: {error}", dir.to_string_lossy()))?;

    Ok(watcher)
}

/// Answers every `et design studio open` request and tells the window which checkout to show.
#[tauri::command]
pub fn design_open_watch(
    app: tauri::AppHandle,
    state: State<'_, OpenWatch>,
    requests: Channel<String>,
) -> Result<(), String> {
    let mut slot = state.0.lock().map_err(|_| "The open watch is poisoned.".to_owned())?;

    *slot = None;
    *slot = Some(watch_requests(
        &checks_dir(),
        move |checkout| add_root(&app, checkout),
        move |checkout| {
            let _ = requests.send(checkout);
        },
    )?);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::StudioError;
    use std::sync::{Arc, Mutex as StdMutex};
    use std::time::{Duration, Instant};

    fn a_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ethlete-studio-{}-{name}", std::process::id()));

        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        dir
    }

    fn keeping(_: &str) -> StudioResult<DesignRoots> {
        Ok(DesignRoots::default())
    }

    fn refusing(_: &str) -> StudioResult<DesignRoots> {
        Err(StudioError::Rejected("no design work".to_owned()))
    }

    #[test]
    fn a_request_is_kept_answered_and_dropped() {
        let dir = a_dir("open-answer");
        let request = dir.join("one.open.json");

        std::fs::write(&request, r#"{"checkout":"/dev/alpha"}"#).unwrap();

        assert_eq!(answer(&request, keeping), Some("/dev/alpha".to_owned()));
        assert_eq!(
            std::fs::read_to_string(dir.join("one.opened.json")).unwrap(),
            r#"{"ok":true,"message":""}"#
        );
        assert!(!request.exists());
    }

    #[test]
    fn a_refused_request_is_answered_with_the_reason_and_not_shown() {
        let dir = a_dir("open-refused");
        let request = dir.join("one.open.json");

        std::fs::write(&request, r#"{"checkout":"/dev/alpha"}"#).unwrap();

        assert_eq!(answer(&request, refusing), None);
        assert!(std::fs::read_to_string(dir.join("one.opened.json"))
            .unwrap()
            .contains(r#""ok":false"#));
    }

    #[test]
    fn a_request_not_fully_written_stays_for_the_next_event() {
        let dir = a_dir("open-partial");
        let request = dir.join("one.open.json");

        std::fs::write(&request, r#"{"check"#).unwrap();

        assert_eq!(answer(&request, keeping), None);
        assert!(request.exists());
        assert!(!dir.join("one.opened.json").exists());
    }

    #[test]
    fn a_request_written_while_watching_is_shown() {
        let dir = a_dir("open-watch");
        let shown = Arc::new(StdMutex::new(Vec::new()));
        let seen = shown.clone();
        let _watcher = watch_requests(&dir, keeping, move |checkout| seen.lock().unwrap().push(checkout)).unwrap();

        std::fs::write(dir.join("one.open.json"), r#"{"checkout":"/dev/alpha"}"#).unwrap();

        let deadline = Instant::now() + Duration::from_secs(5);

        while Instant::now() < deadline && shown.lock().unwrap().is_empty() {
            std::thread::sleep(Duration::from_millis(20));
        }

        assert_eq!(*shown.lock().unwrap(), vec!["/dev/alpha".to_owned()]);
    }
}
