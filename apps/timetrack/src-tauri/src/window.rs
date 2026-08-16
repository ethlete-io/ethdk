use crate::error::{TimetrackError, TimetrackResult};
use crate::samples::{Sample, SampleBatch, SampleBuffer};
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
}

pub type WindowEvent = Sample<WindowEventPayload>;
pub type WindowEventBatch = SampleBatch<WindowEventPayload>;

/// The window and presence samples the platform source has produced, and what the platform source is
/// currently able to see.
#[derive(Clone)]
pub struct WindowSource {
    samples: SampleBuffer<WindowEventPayload>,
    status: Arc<Mutex<WindowSourceStatus>>,
}

impl WindowSource {
    pub fn new() -> Self {
        Self {
            samples: SampleBuffer::new(),
            status: Arc::new(Mutex::new(WindowSourceStatus {
                kind: "none".to_string(),
                detail: Some("the window source has not started yet".to_string()),
            })),
        }
    }

    pub fn set_paused(&self, paused: bool) {
        self.samples.set_paused(paused);
    }

    pub fn is_paused(&self) -> bool {
        self.samples.is_paused()
    }

    pub fn push(&self, at_ms: i64, payload: WindowEventPayload) {
        self.samples.push(at_ms, payload);
    }

    pub fn set_status(&self, kind: &str, detail: Option<String>) {
        if let Ok(mut status) = self.status.lock() {
            *status = WindowSourceStatus {
                kind: kind.to_string(),
                detail,
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
        Self::new()
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
        let source = WindowSource::new();

        source.set_paused(true);
        source.push(10, focus("code", "a"));

        assert!(source.drain_after(0).unwrap().events.is_empty());
    }

    #[test]
    fn reports_what_the_platform_source_last_said_about_itself() {
        let source = WindowSource::new();

        source.set_status("macos-app-only", Some("the Accessibility permission is not granted".to_string()));

        assert_eq!(source.status().unwrap().kind, "macos-app-only");
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
