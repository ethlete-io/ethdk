use crate::error::{TimetrackError, TimetrackResult};
#[cfg(test)]
use crate::samples::Sample;
use crate::samples::{SampleBatch, SampleBuffer};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::State;

/// Which process held the microphone, by the identifier the platform names a process with.
///
/// It is reported raw, helper suffix and all: on macOS `com.hnc.Discord.helper.Renderer` is what holds
/// the microphone and it is a prefix of the window source's own `com.hnc.Discord`. The read side
/// matches the two by prefix, so nothing here needs a table of exceptions.
#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum CallEventPayload {
    CallStart {
        #[serde(rename = "appId")]
        app_id: String,
    },
    CallEnd {
        #[serde(rename = "appId")]
        app_id: String,
    },
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallSourceStatus {
    /// `macos-core-audio` when CoreAudio is watching, `none` when no source could start.
    pub kind: String,
    /// Why there is no source, for the banner naming what is degraded.
    pub detail: Option<String>,
}

#[cfg(test)]
pub type CallEvent = Sample<CallEventPayload>;
pub type CallEventBatch = SampleBatch<CallEventPayload>;

/// Which processes are holding the microphone, and what the platform source is able to see.
#[derive(Clone)]
pub struct CallSource {
    samples: SampleBuffer<CallEventPayload>,
    status: Arc<Mutex<CallSourceStatus>>,
    holding: Arc<Mutex<Vec<String>>>,
}

impl CallSource {
    pub fn new() -> Self {
        Self {
            samples: SampleBuffer::new(),
            status: Arc::new(Mutex::new(CallSourceStatus {
                kind: "none".to_string(),
                detail: Some("the call source has not started yet".to_string()),
            })),
            holding: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn set_paused(&self, paused: bool) {
        self.samples.set_paused(paused);
    }

    pub fn is_paused(&self) -> bool {
        self.samples.is_paused()
    }

    /// Reconciles who holds the microphone against who held it, and pushes one edge per difference.
    ///
    /// The whole set rather than one process at a time, because a platform listener says a property
    /// changed and not which way: re-reading everything is what makes a missed callback cost a late
    /// edge instead of a stuck call. Pushing the same set twice pushes nothing.
    pub fn reconcile(&self, at_ms: i64, holding: Vec<String>) {
        let Ok(mut held) = self.holding.lock() else {
            return;
        };

        for app_id in held.iter() {
            if !holding.contains(app_id) {
                self.samples
                    .push(at_ms, CallEventPayload::CallEnd { app_id: app_id.clone() });
            }
        }

        for app_id in &holding {
            if !held.contains(app_id) {
                self.samples
                    .push(at_ms, CallEventPayload::CallStart { app_id: app_id.clone() });
            }
        }

        *held = holding;
    }

    /// Forgets who was holding the microphone, so the next reconcile re-opens whatever is still held.
    ///
    /// A pause stores no sample, so a call that outlives one would otherwise never be seen to start,
    /// and its end would arrive as an edge with no opening.
    pub fn forget(&self) {
        if let Ok(mut held) = self.holding.lock() {
            held.clear();
        }
    }

    pub fn set_status(&self, kind: &str, detail: Option<String>) {
        if let Ok(mut status) = self.status.lock() {
            *status = CallSourceStatus {
                kind: kind.to_string(),
                detail,
            };
        }
    }

    pub(crate) fn drain_after(&self, after_seq: u64) -> TimetrackResult<CallEventBatch> {
        self.samples.drain_after(after_seq)
    }

    pub(crate) fn status(&self) -> TimetrackResult<CallSourceStatus> {
        Ok(self.status.lock().map_err(|_| TimetrackError::Poisoned)?.clone())
    }
}

impl Default for CallSource {
    fn default() -> Self {
        Self::new()
    }
}

/// Hands back everything buffered after `after_seq`, and releases everything up to it.
///
/// Pass the sequence the last batch was actually stored under, not the one it ended at: acknowledging
/// a batch that failed to store would drop it.
#[tauri::command]
pub async fn call_events(source: State<'_, CallSource>, after_seq: u64) -> TimetrackResult<CallEventBatch> {
    source.drain_after(after_seq)
}

#[tauri::command]
pub async fn call_source_status(source: State<'_, CallSource>) -> TimetrackResult<CallSourceStatus> {
    source.status()
}

pub fn start(source: &CallSource) {
    #[cfg(target_os = "macos")]
    crate::calls_macos::start(source.clone());

    #[cfg(not(target_os = "macos"))]
    source.set_status(
        "none",
        Some("no call source is implemented for this platform yet".to_string()),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn held(source: &CallSource) -> Vec<CallEvent> {
        source.drain_after(0).unwrap().events
    }

    fn app_of(payload: &CallEventPayload) -> &str {
        match payload {
            CallEventPayload::CallStart { app_id } | CallEventPayload::CallEnd { app_id } => app_id,
        }
    }

    #[test]
    fn opens_a_call_for_a_process_that_took_the_microphone() {
        let source = CallSource::default();

        source.reconcile(10, vec!["com.hnc.Discord.helper.Renderer".to_string()]);

        let events = held(&source);

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].at_ms, 10);
        assert!(matches!(events[0].payload, CallEventPayload::CallStart { .. }));
        assert_eq!(app_of(&events[0].payload), "com.hnc.Discord.helper.Renderer");
    }

    #[test]
    fn pushes_nothing_while_the_same_process_keeps_holding_it() {
        let source = CallSource::default();

        source.reconcile(10, vec!["com.hnc.Discord".to_string()]);
        source.reconcile(20, vec!["com.hnc.Discord".to_string()]);
        source.reconcile(30, vec!["com.hnc.Discord".to_string()]);

        assert_eq!(held(&source).len(), 1);
    }

    #[test]
    fn closes_the_call_when_the_process_lets_go() {
        let source = CallSource::default();

        source.reconcile(10, vec!["com.hnc.Discord".to_string()]);
        source.reconcile(90, vec![]);

        let events = held(&source);

        assert_eq!(events.len(), 2);
        assert_eq!(events[1].at_ms, 90);
        assert!(matches!(events[1].payload, CallEventPayload::CallEnd { .. }));
    }

    #[test]
    fn closes_one_call_and_opens_another_at_the_same_instant() {
        let source = CallSource::default();

        source.reconcile(10, vec!["com.hnc.Discord".to_string()]);
        source.reconcile(50, vec!["com.tinyspeck.slackmacgap".to_string()]);

        let events = held(&source);

        assert_eq!(events.len(), 3);
        assert!(matches!(events[1].payload, CallEventPayload::CallEnd { .. }));
        assert_eq!(app_of(&events[1].payload), "com.hnc.Discord");
        assert!(matches!(events[2].payload, CallEventPayload::CallStart { .. }));
        assert_eq!(app_of(&events[2].payload), "com.tinyspeck.slackmacgap");
    }

    #[test]
    fn keeps_a_second_call_open_when_the_first_one_ends() {
        let source = CallSource::default();

        source.reconcile(
            10,
            vec!["com.hnc.Discord".to_string(), "com.tinyspeck.slackmacgap".to_string()],
        );
        source.reconcile(50, vec!["com.tinyspeck.slackmacgap".to_string()]);

        let events = held(&source);

        assert_eq!(events.len(), 3);
        assert_eq!(app_of(&events[2].payload), "com.hnc.Discord");
        assert!(matches!(events[2].payload, CallEventPayload::CallEnd { .. }));
    }

    #[test]
    fn takes_no_sample_at_all_while_collection_is_paused() {
        let source = CallSource::default();

        source.set_paused(true);
        source.reconcile(10, vec!["com.hnc.Discord".to_string()]);

        assert!(held(&source).is_empty());
    }

    #[test]
    fn re_opens_a_call_that_outlived_a_pause() {
        let source = CallSource::default();

        source.set_paused(true);
        source.reconcile(10, vec!["com.hnc.Discord".to_string()]);
        source.forget();
        source.set_paused(false);
        source.reconcile(60_000, vec!["com.hnc.Discord".to_string()]);

        let events = held(&source);

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].at_ms, 60_000);
        assert!(matches!(events[0].payload, CallEventPayload::CallStart { .. }));
    }

    #[test]
    fn reports_what_the_platform_source_last_said_about_itself() {
        let source = CallSource::default();

        source.set_status("macos-core-audio", None);

        assert_eq!(source.status().unwrap().kind, "macos-core-audio");
    }

    #[test]
    fn serializes_a_call_the_way_the_webview_reads_it() {
        let source = CallSource::default();

        source.reconcile(1_700_000_000_000, vec!["com.hnc.Discord.helper.Renderer".to_string()]);

        let json = serde_json::to_value(&held(&source)[0]).unwrap();

        assert_eq!(json["seq"], 1);
        assert_eq!(json["atMs"], 1_700_000_000_000_i64);
        assert_eq!(json["kind"], "call-start");
        assert_eq!(json["appId"], "com.hnc.Discord.helper.Renderer");
    }
}
