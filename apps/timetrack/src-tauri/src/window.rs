use crate::error::{TimetrackError, TimetrackResult};
#[cfg(test)]
use crate::samples::Sample;
use crate::samples::{SampleBatch, SampleBuffer};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum WindowEventPayload {
    WindowFocus {
        #[serde(rename = "appId")]
        app_id: String,
        title: String,
    },
    IdleStart,
    IdleEnd,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSourceStatus {
    /// `wayland-wlr` once the toplevel protocol is live, `macos-ax` when the Accessibility permission
    /// grants titles, `macos-app-only` when it does not, `none` when no source could start.
    pub kind: String,
    /// Why there is no source, for the banner naming what is degraded.
    pub detail: Option<String>,
    /// What the running source can observe here. The host answers this so that no screen above it has
    /// to know which platform, protocol or compositor is behind the source.
    pub capabilities: Vec<WindowSourceCapability>,
}

/// One thing the running source does, or does not, read about the focused window.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSourceCapability {
    /// `app-id`, `title` or `working-directory`.
    pub reads: String,
    pub available: bool,
    /// Why this machine does not read it. `None` while it does.
    pub detail: Option<String>,
}

const WLR_HAS_NO_PROCESS: &str =
    "The wlr toplevel protocol reports an application id, a title and a state, and no process id.";

const NO_ACCESSIBILITY: &str = "Timetrack has no Accessibility permission.";

const NO_WORKING_DIRECTORY_YET: &str = "No source reads a window's working directory yet.";

fn capability(reads: &str, detail: Option<&str>) -> WindowSourceCapability {
    WindowSourceCapability {
        reads: reads.to_string(),
        available: detail.is_none(),
        detail: detail.map(str::to_string),
    }
}

/// A source that is not running reads nothing, and the row's badge already says so, so it reports an
/// empty list rather than three denials.
fn capabilities_of(kind: &str) -> Vec<WindowSourceCapability> {
    match kind {
        "wayland-wlr" => vec![
            capability("app-id", None),
            capability("title", None),
            capability("working-directory", Some(WLR_HAS_NO_PROCESS)),
        ],
        "macos-ax" => vec![
            capability("app-id", None),
            capability("title", None),
            capability("working-directory", Some(NO_WORKING_DIRECTORY_YET)),
        ],
        "macos-app-only" => vec![
            capability("app-id", None),
            capability("title", Some(NO_ACCESSIBILITY)),
            capability("working-directory", Some(NO_WORKING_DIRECTORY_YET)),
        ],
        _ => Vec::new(),
    }
}

#[cfg(test)]
pub type WindowEvent = Sample<WindowEventPayload>;
pub type WindowEventBatch = SampleBatch<WindowEventPayload>;

/// The window and presence samples the platform source has produced, and what the platform source is
/// currently able to see.
#[derive(Clone)]
pub struct WindowSource {
    samples: SampleBuffer<WindowEventPayload>,
    status: Arc<Mutex<WindowSourceStatus>>,
    lock: crate::lock::WindowLock,
}

impl WindowSource {
    pub fn new(lock: crate::lock::WindowLock) -> Self {
        Self {
            samples: SampleBuffer::new(),
            status: Arc::new(Mutex::new(WindowSourceStatus {
                kind: "none".to_string(),
                detail: Some("the window source has not started yet".to_string()),
                capabilities: Vec::new(),
            })),
            lock,
        }
    }

    pub fn set_paused(&self, paused: bool) {
        self.samples.set_paused(paused);
    }

    pub fn is_paused(&self) -> bool {
        self.samples.is_paused()
    }

    /// The lock is told before the buffer, because a paused collector stores no sample and the window
    /// must lock itself whether or not the day is being reconstructed.
    pub fn push(&self, at_ms: i64, payload: WindowEventPayload) {
        match payload {
            WindowEventPayload::IdleStart => self.lock.went_idle(at_ms),
            WindowEventPayload::IdleEnd => self.lock.came_back(),
            WindowEventPayload::WindowFocus { .. } => {}
        }

        self.samples.push(at_ms, payload);
    }

    pub fn set_status(&self, kind: &str, detail: Option<String>) {
        if let Ok(mut status) = self.status.lock() {
            *status = WindowSourceStatus {
                kind: kind.to_string(),
                detail,
                capabilities: capabilities_of(kind),
            };
        }
    }

    pub(crate) fn drain_after(&self, after_seq: u64) -> TimetrackResult<WindowEventBatch> {
        self.samples.drain_after(after_seq)
    }

    pub(crate) fn status(&self) -> TimetrackResult<WindowSourceStatus> {
        Ok(self.status.lock().map_err(|_| TimetrackError::Poisoned)?.clone())
    }
}

impl Default for WindowSource {
    fn default() -> Self {
        Self::new(crate::lock::WindowLock::new())
    }
}

/// Hands back everything buffered after `after_seq`, and releases everything up to it.
///
/// Pass the sequence the last batch was actually stored under, not the one it ended at: acknowledging
/// a batch that failed to store would drop it.
#[tauri::command]
pub async fn window_events(source: State<'_, WindowSource>, after_seq: u64) -> TimetrackResult<WindowEventBatch> {
    source.drain_after(after_seq)
}

#[tauri::command]
pub async fn window_source_status(source: State<'_, WindowSource>) -> TimetrackResult<WindowSourceStatus> {
    source.status()
}

/// Asks the platform for whatever permission window titles need, and answers the state after asking.
///
/// A platform that needs no permission answers `true`, so the caller never has to ask which one it is
/// on: the status is where a source that is missing something says so.
#[tauri::command]
pub async fn window_request_accessibility() -> TimetrackResult<bool> {
    Ok(request_accessibility())
}

#[cfg(target_os = "macos")]
fn request_accessibility() -> bool {
    crate::window_macos::request_accessibility()
}

#[cfg(not(target_os = "macos"))]
fn request_accessibility() -> bool {
    true
}

pub fn start(source: &WindowSource) {
    #[cfg(target_os = "linux")]
    crate::window_wayland::start(source.clone());

    #[cfg(target_os = "macos")]
    crate::window_macos::start(source.clone());

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    source.set_status(
        "none",
        Some("no window source is implemented for this platform yet".to_string()),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn focus(app_id: &str, title: &str) -> WindowEventPayload {
        WindowEventPayload::WindowFocus {
            app_id: app_id.to_string(),
            title: title.to_string(),
        }
    }

    #[test]
    fn takes_no_sample_at_all_while_collection_is_paused() {
        let source = WindowSource::default();

        source.set_paused(true);
        source.push(10, focus("code", "a"));

        assert!(source.drain_after(0).unwrap().events.is_empty());
    }

    #[test]
    fn reports_what_the_platform_source_last_said_about_itself() {
        let source = WindowSource::default();

        source.set_status(
            "macos-app-only",
            Some("the Accessibility permission is not granted".to_string()),
        );

        assert_eq!(source.status().unwrap().kind, "macos-app-only");
    }

    #[test]
    fn says_a_wlr_source_reads_the_application_and_the_title_and_no_working_directory() {
        let source = WindowSource::default();

        source.set_status("wayland-wlr", None);

        let capabilities = source.status().unwrap().capabilities;
        let directory = capabilities
            .iter()
            .find(|held| held.reads == "working-directory")
            .unwrap();

        assert!(capabilities
            .iter()
            .all(|held| held.available || held.reads == "working-directory"));
        assert!(!directory.available);
        assert_eq!(directory.detail.as_deref(), Some(WLR_HAS_NO_PROCESS));
    }

    #[test]
    fn says_a_macos_source_without_the_permission_reads_no_title() {
        let source = WindowSource::default();

        source.set_status("macos-app-only", None);

        let capabilities = source.status().unwrap().capabilities;
        let title = capabilities.iter().find(|held| held.reads == "title").unwrap();

        assert!(!title.available);
        assert_eq!(title.detail.as_deref(), Some(NO_ACCESSIBILITY));
    }

    #[test]
    fn says_a_macos_source_with_the_permission_reads_the_title() {
        let source = WindowSource::default();

        source.set_status("macos-ax", None);

        let capabilities = source.status().unwrap().capabilities;

        assert!(
            capabilities
                .iter()
                .find(|held| held.reads == "title")
                .unwrap()
                .available
        );
    }

    #[test]
    fn claims_nothing_at_all_while_no_source_is_running() {
        let source = WindowSource::default();

        source.set_status("none", Some("the window source stopped".to_string()));

        assert!(source.status().unwrap().capabilities.is_empty());
    }

    #[test]
    fn serializes_a_focus_sample_the_way_the_webview_reads_it() {
        let event = WindowEvent {
            seq: 7,
            at_ms: 1_700_000_000_000,
            payload: focus("code", "lib.rs - timetrack"),
        };

        let json = serde_json::to_value(&event).unwrap();

        assert_eq!(json["seq"], 7);
        assert_eq!(json["atMs"], 1_700_000_000_000_i64);
        assert_eq!(json["kind"], "window-focus");
        assert_eq!(json["appId"], "code");
        assert_eq!(json["title"], "lib.rs - timetrack");
    }

    #[test]
    fn serializes_presence_without_window_fields() {
        let json = serde_json::to_value(WindowEvent {
            seq: 1,
            at_ms: 5,
            payload: WindowEventPayload::IdleStart,
        })
        .unwrap();

        assert_eq!(json["kind"], "idle-start");
        assert!(json.get("appId").is_none());
    }
}
