use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

use crate::design_roots::{add_root, DesignRoots};
use crate::error::StudioResult;

const REQUEST_SUFFIX: &str = ".open.json";
const REPLY_SUFFIX: &str = ".opened.json";
const KEEP_REQUESTS_FOR: Duration = Duration::from_secs(7 * 24 * 60 * 60);

#[derive(Deserialize)]
struct Request {
    checkout: String,
}

#[derive(Serialize)]
struct Reply {
    ok: bool,
    message: String,
}

/// The folder where `et design studio open` requests wait for Studio. It must survive a reboot, so it is not the temp
/// folder, and it must match `openRequestsDirOf` in `libs/cli/src/lib/design/studio-open.ts`.
fn open_requests_dir_of(os: &str, var: impl Fn(&str) -> Option<OsString>) -> PathBuf {
    let set = |key: &str| var(key).filter(|value| !value.is_empty()).map(PathBuf::from);
    let home = || set(if os == "windows" { "USERPROFILE" } else { "HOME" }).unwrap_or_default();
    let base = match os {
        "windows" => set("LOCALAPPDATA").unwrap_or_else(|| home().join("AppData").join("Local")),
        "macos" => home().join("Library").join("Application Support"),
        _ => set("XDG_STATE_HOME").unwrap_or_else(|| home().join(".local").join("state")),
    };

    base.join("ethlete-studio").join("open-requests")
}

fn open_requests_dir() -> PathBuf {
    open_requests_dir_of(std::env::consts::OS, |key| std::env::var_os(key))
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

/// Answers the requests a cli left while Studio was down. Every live one is added to the list; the newest one is
/// the checkout to show. Requests past `KEEP_REQUESTS_FOR` and requests whose checkout lost its design config are
/// deleted.
fn answer_kept(dir: &Path, now: SystemTime, add: &impl Fn(&str) -> StudioResult<DesignRoots>) -> Option<String> {
    let mut live: Vec<(SystemTime, PathBuf)> = Vec::new();

    for request in pending(dir) {
        let modified = std::fs::metadata(&request)
            .and_then(|meta| meta.modified())
            .unwrap_or(now);
        let stale = now.duration_since(modified).is_ok_and(|age| age > KEEP_REQUESTS_FOR);
        let gone = std::fs::read_to_string(&request)
            .ok()
            .and_then(|text| serde_json::from_str::<Request>(&text).ok())
            .is_some_and(|parsed| !Path::new(&parsed.checkout).join(".ethlete/design/config.json").exists());

        if stale || gone {
            let _ = std::fs::remove_file(&request);
        } else {
            live.push((modified, request));
        }
    }

    live.sort();

    live.into_iter()
        .fold(None, |shown, (_, request)| answer(&request, add).or(shown))
}

fn watch_requests(
    dir: &Path,
    add: impl Fn(&str) -> StudioResult<DesignRoots> + Send + 'static,
    show: impl Fn(String) + Send + 'static,
) -> Result<RecommendedWatcher, String> {
    std::fs::create_dir_all(dir).map_err(|error| format!("Unable to create {}: {error}", dir.to_string_lossy()))?;

    if let Some(checkout) = answer_kept(dir, SystemTime::now(), &add) {
        show(checkout);
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
        &open_requests_dir(),
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

    fn env_of<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<OsString> + 'a {
        move |key| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| OsString::from(value))
        }
    }

    #[test]
    fn requests_wait_in_a_folder_that_survives_a_reboot_per_os() {
        assert_eq!(
            open_requests_dir_of("linux", env_of(&[("HOME", "/home/a")])),
            PathBuf::from("/home/a/.local/state/ethlete-studio/open-requests")
        );
        assert_eq!(
            open_requests_dir_of("linux", env_of(&[("HOME", "/home/a"), ("XDG_STATE_HOME", "/state")])),
            PathBuf::from("/state/ethlete-studio/open-requests")
        );
        assert_eq!(
            open_requests_dir_of("macos", env_of(&[("HOME", "/Users/a")])),
            PathBuf::from("/Users/a/Library/Application Support/ethlete-studio/open-requests")
        );
        assert_eq!(
            open_requests_dir_of("windows", env_of(&[("LOCALAPPDATA", "C:/Users/a/AppData/Local")])),
            PathBuf::from("C:/Users/a/AppData/Local")
                .join("ethlete-studio")
                .join("open-requests")
        );
    }

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

    fn a_checkout(dir: &Path, name: &str) -> String {
        let checkout = dir.join(name);

        std::fs::create_dir_all(checkout.join(".ethlete/design")).unwrap();
        std::fs::write(checkout.join(".ethlete/design/config.json"), "{}").unwrap();

        checkout.to_string_lossy().into_owned()
    }

    fn aged(path: &Path, days: u64) {
        let file = std::fs::File::options().write(true).open(path).unwrap();

        file.set_modified(SystemTime::now() - Duration::from_secs(days * 24 * 60 * 60))
            .unwrap();
    }

    #[test]
    fn a_request_left_while_studio_was_down_is_kept_and_shown_at_start() {
        let dir = a_dir("open-kept");
        let checkout = a_checkout(&dir, "client-runs/2026-11-25-0236/tomflix");
        let request = dir.join("one.open.json");
        let added = StdMutex::new(Vec::new());

        std::fs::write(&request, format!(r#"{{"checkout":"{checkout}"}}"#)).unwrap();

        let shown = answer_kept(&dir, SystemTime::now(), &|path: &str| {
            added.lock().unwrap().push(path.to_owned());
            keeping(path)
        });

        assert_eq!(shown, Some(checkout.clone()));
        assert_eq!(*added.lock().unwrap(), vec![checkout]);
    }

    #[test]
    fn at_start_every_live_request_is_added_and_only_the_newest_is_shown() {
        let dir = a_dir("open-newest");
        let old = a_checkout(&dir, "old");
        let new = a_checkout(&dir, "new");
        let added = StdMutex::new(Vec::new());

        std::fs::write(dir.join("a.open.json"), format!(r#"{{"checkout":"{new}"}}"#)).unwrap();
        std::fs::write(dir.join("b.open.json"), format!(r#"{{"checkout":"{old}"}}"#)).unwrap();
        aged(&dir.join("b.open.json"), 2);

        let shown = answer_kept(&dir, SystemTime::now(), &|path: &str| {
            added.lock().unwrap().push(path.to_owned());
            keeping(path)
        });

        assert_eq!(shown, Some(new.clone()));
        assert_eq!(added.lock().unwrap().len(), 2);
    }

    #[test]
    fn a_request_older_than_seven_days_is_dropped_at_start() {
        let dir = a_dir("open-stale");
        let checkout = a_checkout(&dir, "tomflix");
        let request = dir.join("one.open.json");

        std::fs::write(&request, format!(r#"{{"checkout":"{checkout}"}}"#)).unwrap();
        aged(&request, 8);

        assert_eq!(answer_kept(&dir, SystemTime::now(), &keeping), None);
        assert!(!request.exists());
    }

    #[test]
    fn a_request_whose_checkout_is_gone_is_dropped_at_start() {
        let dir = a_dir("open-missing");
        let request = dir.join("one.open.json");

        std::fs::write(
            &request,
            r#"{"checkout":"/nonexistent/client-runs/2026-11-25-0236/tomflix"}"#,
        )
        .unwrap();

        assert_eq!(answer_kept(&dir, SystemTime::now(), &keeping), None);
        assert!(!request.exists());
    }
}
