use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, Runtime, UserAttentionType};
use tauri_plugin_notification::NotificationExt;

const AT_MOST_EVERY: Duration = Duration::from_secs(30);

pub struct AttentionGate {
    last: Mutex<Option<Instant>>,
}

impl AttentionGate {
    pub fn new() -> Self {
        Self { last: Mutex::new(None) }
    }

    fn admit(&self, now: Instant) -> bool {
        let Ok(mut last) = self.last.lock() else {
            return false;
        };

        if last.is_some_and(|at| now.saturating_duration_since(at) < AT_MOST_EVERY) {
            return false;
        }

        *last = Some(now);

        true
    }
}

impl Default for AttentionGate {
    fn default() -> Self {
        Self::new()
    }
}

/// A hidden window has no taskbar button or urgency hint, so on Linux and Windows a locked app is
/// surfaced by the notification alone; the dock bounces on macOS either way.
pub fn surface<R: Runtime>(app: &AppHandle<R>, gate: &AttentionGate, title: &str, body: &str) {
    let window = app.get_webview_window("main");

    if window
        .as_ref()
        .is_some_and(|window| window.is_focused().unwrap_or(false))
    {
        return;
    }

    if !gate.admit(Instant::now()) {
        return;
    }

    if let Some(window) = window {
        let _ = window.request_user_attention(Some(UserAttentionType::Informational));
    }

    let _ = app.notification().builder().title(title).body(body).show();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surfaces_the_first_request() {
        assert!(AttentionGate::new().admit(Instant::now()));
    }

    #[test]
    fn stays_quiet_for_a_request_inside_the_interval() {
        let gate = AttentionGate::new();
        let first = Instant::now();

        assert!(gate.admit(first));
        assert!(!gate.admit(first + Duration::from_secs(1)));
        assert!(!gate.admit(first + AT_MOST_EVERY - Duration::from_millis(1)));
    }

    #[test]
    fn surfaces_again_once_the_interval_has_passed() {
        let gate = AttentionGate::new();
        let first = Instant::now();

        assert!(gate.admit(first));
        assert!(gate.admit(first + AT_MOST_EVERY));
        assert!(!gate.admit(first + AT_MOST_EVERY + Duration::from_secs(1)));
    }

    #[test]
    fn counts_the_interval_from_the_request_that_surfaced_not_from_the_ones_it_swallowed() {
        let gate = AttentionGate::new();
        let first = Instant::now();

        assert!(gate.admit(first));
        assert!(!gate.admit(first + Duration::from_secs(20)));
        assert!(gate.admit(first + Duration::from_secs(31)));
    }
}
