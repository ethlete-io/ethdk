use crate::error::{TimetrackError, TimetrackResult};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tauri::State;

/// Samples held before the oldest is dropped. A webview that stopped draining must not be able to grow
/// the host without bound, and `dropped` is what tells the collector the gap was loss, not idleness.
const MAX_BUFFERED: usize = 4096;

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
pub struct WindowEvent {
    pub seq: u64,
    pub at_ms: i64,
    #[serde(flatten)]
    pub payload: WindowEventPayload,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowEventBatch {
    pub events: Vec<WindowEvent>,
    pub next_seq: u64,
    /// Samples dropped since the last drain because the buffer was full.
    pub dropped: u64,
}

struct Buffer {
    events: VecDeque<WindowEvent>,
    next_seq: u64,
    dropped: u64,
}

struct Inner {
    buffer: Mutex<Buffer>,
    status: Mutex<WindowSourceStatus>,
}

/// The window and presence samples the platform source has produced but nothing has stored yet.
///
/// A sample is kept until the collector drains past its `seq` rather than until it is read, so a
/// webview that reloaded between reading and storing sees it again. Re-storing an identical sample is
/// harmless; losing one leaves a gap that reads as absence.
#[derive(Clone)]
pub struct WindowSource(Arc<Inner>);

impl WindowSource {
    pub fn new() -> Self {
        Self(Arc::new(Inner {
            buffer: Mutex::new(Buffer {
                events: VecDeque::new(),
                next_seq: 1,
                dropped: 0,
            }),
            status: Mutex::new(WindowSourceStatus {
                kind: "none".to_string(),
                detail: Some("the window source has not started yet".to_string()),
            }),
        }))
    }

    pub fn push(&self, at_ms: i64, payload: WindowEventPayload) {
        let Ok(mut buffer) = self.0.buffer.lock() else {
            return;
        };

        let seq = buffer.next_seq;

        buffer.next_seq += 1;
        buffer.events.push_back(WindowEvent { seq, at_ms, payload });

        while buffer.events.len() > MAX_BUFFERED {
            buffer.events.pop_front();
            buffer.dropped += 1;
        }
    }

    pub fn set_status(&self, kind: &str, detail: Option<String>) {
        if let Ok(mut status) = self.0.status.lock() {
            *status = WindowSourceStatus {
                kind: kind.to_string(),
                detail,
            };
        }
    }

    pub(crate) fn drain_after(&self, after_seq: u64) -> TimetrackResult<WindowEventBatch> {
        let mut buffer = self.0.buffer.lock().map_err(|_| TimetrackError::Poisoned)?;

        while buffer.events.front().is_some_and(|event| event.seq <= after_seq) {
            buffer.events.pop_front();
        }

        let dropped = std::mem::take(&mut buffer.dropped);

        Ok(WindowEventBatch {
            events: buffer.events.iter().cloned().collect(),
            next_seq: buffer.next_seq,
            dropped,
        })
    }

    pub(crate) fn status(&self) -> TimetrackResult<WindowSourceStatus> {
        Ok(self.0.status.lock().map_err(|_| TimetrackError::Poisoned)?.clone())
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
    fn drains_in_order_and_numbers_from_one() {
        let source = WindowSource::new();

        source.push(10, focus("code", "a"));
        source.push(20, focus("firefox", "b"));

        let batch = source.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), 2);
        assert_eq!(batch.events[0].seq, 1);
        assert_eq!(batch.events[1].seq, 2);
        assert_eq!(batch.next_seq, 3);
        assert_eq!(batch.dropped, 0);
    }

    #[test]
    fn keeps_unacknowledged_samples_for_the_next_drain() {
        let source = WindowSource::new();

        source.push(10, focus("code", "a"));
        source.push(20, focus("firefox", "b"));

        assert_eq!(source.drain_after(0).unwrap().events.len(), 2);
        assert_eq!(source.drain_after(0).unwrap().events.len(), 2);

        let batch = source.drain_after(1).unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].seq, 2);
    }

    #[test]
    fn drops_the_oldest_when_nothing_drains_and_reports_it_once() {
        let source = WindowSource::new();

        for index in 0..(MAX_BUFFERED + 5) {
            source.push(index as i64, focus("code", "a"));
        }

        let batch = source.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), MAX_BUFFERED);
        assert_eq!(batch.dropped, 5);
        assert_eq!(batch.events[0].seq, 6);
        assert_eq!(source.drain_after(0).unwrap().dropped, 0);
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
