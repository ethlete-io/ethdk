//! A lock over the window, which is not a lock over the database.
//!
//! The database holds months of window titles and session titles, and it decrypts at startup because
//! the collectors write to it every minute. So the thing that can be locked is the reading of it: the
//! window starts hidden, every route back to it goes through an account-password check, and collection
//! never notices. A lock that stopped collection would punch a hole in the day, which is the failure the
//! hard pause is built around — and unlike a pause, a lock has nothing to record and nothing to
//! reconstruct.

use crate::auth;
use crate::error::TimetrackResult;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

/// Told to the webview so it can clear the view it is showing before the window goes away.
pub const LOCKED_EVENT: &str = "window-locked";

/// How long after the user goes idle the window locks itself, when the document says nothing.
///
/// The window source reports idleness at five minutes, so this is the wait on top of that.
const DEFAULT_LOCK_AFTER_IDLE_MS: i64 = 60_000;

/// The longest wait a settings document may ask for.
///
/// It mirrors `MAX_LOCK_AFTER_IDLE_MS` in the core, and has to: the host reads that document itself
/// rather than through the parser that would have clamped it.
const MAX_LOCK_AFTER_IDLE_MS: i64 = 60 * 60_000;

/// What the settings document says about the lock.
///
/// The host reads these two fields for itself rather than being told them. It has to know before any
/// view is mounted, and the thread that acts on them must not depend on a webview that is showing the
/// password prompt.
pub struct LockSettings {
    enabled: bool,
    after_idle_ms: i64,
}

impl LockSettings {
    /// Reads the lock's two fields out of a settings document, treating anything it cannot make sense
    /// of as the default. The shape of that document belongs to the core; this is all the host wants
    /// from it.
    pub fn read(document: &serde_json::Value) -> Self {
        let default = Self::default();

        Self {
            enabled: document
                .get("lockWindow")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(default.enabled),
            after_idle_ms: document
                .get("lockAfterIdleMs")
                .and_then(serde_json::Value::as_f64)
                .map(|value| (value.round() as i64).clamp(0, MAX_LOCK_AFTER_IDLE_MS))
                .unwrap_or(default.after_idle_ms),
        }
    }
}

impl Default for LockSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            after_idle_ms: DEFAULT_LOCK_AFTER_IDLE_MS,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LockState {
    pub locked: bool,
    /// `false` where the webview has to collect the account password itself, as on Linux.
    pub prompts_itself: bool,
}

/// Whether the window may be shown, and when idleness started counting towards locking it.
///
/// The state is deliberately not persisted. It starts locked on every run, which is the point — the
/// complaint this answers is that the database used to decrypt at startup and show itself to whoever
/// was sitting there.
#[derive(Clone)]
pub struct WindowLock {
    locked: Arc<AtomicBool>,
    /// When the user last went idle, or 0 while they are present.
    idle_since_ms: Arc<AtomicI64>,
    enabled: Arc<AtomicBool>,
    after_idle_ms: Arc<AtomicI64>,
}

impl WindowLock {
    /// Locked from the start, unless this machine cannot check the account password — a lock with no
    /// way past it would leave the app unopenable, which is worse than showing the window.
    pub fn new() -> Self {
        let usable = auth::can_verify();

        Self {
            locked: Arc::new(AtomicBool::new(usable)),
            idle_since_ms: Arc::new(AtomicI64::new(0)),
            enabled: Arc::new(AtomicBool::new(usable)),
            after_idle_ms: Arc::new(AtomicI64::new(DEFAULT_LOCK_AFTER_IDLE_MS)),
        }
    }

    pub fn is_locked(&self) -> bool {
        self.enabled.load(Ordering::SeqCst) && self.locked.load(Ordering::SeqCst)
    }

    /// Applies the user's settings. Turning the lock on is refused where the password cannot be
    /// checked, for the same reason `new` starts unlocked there.
    pub fn apply(&self, settings: &LockSettings) {
        let enabled = settings.enabled && auth::can_verify();

        self.enabled.store(enabled, Ordering::SeqCst);
        self.after_idle_ms.store(settings.after_idle_ms, Ordering::SeqCst);

        if !enabled {
            self.locked.store(false, Ordering::SeqCst);
        }
    }

    pub fn state(&self) -> LockState {
        LockState {
            locked: self.is_locked(),
            prompts_itself: auth::collects_its_own_secret(),
        }
    }

    /// Notes that the user went away, so `lock_if_idle_long_enough` can act on it later.
    pub fn went_idle(&self, at_ms: i64) {
        self.idle_since_ms.store(at_ms, Ordering::SeqCst);
    }

    pub fn came_back(&self) {
        self.idle_since_ms.store(0, Ordering::SeqCst);
    }

    fn idle_since(&self) -> Option<i64> {
        match self.idle_since_ms.load(Ordering::SeqCst) {
            0 => None,
            at => Some(at),
        }
    }
}

impl Default for WindowLock {
    fn default() -> Self {
        Self::new()
    }
}

/// Tells the webview to stop showing what was in the window, then puts the window away.
///
/// The order matters: the webview swaps to the lock view on the event, and the window it is later
/// revealed into has to be showing that rather than the day it was left on. Revealing a locked window
/// is how the user reaches the password prompt, so no route back to the window is blocked.
pub fn lock<R: Runtime>(app: &AppHandle<R>) {
    let Some(state) = app.try_state::<WindowLock>() else {
        return;
    };

    if !state.enabled.load(Ordering::SeqCst) || state.locked.swap(true, Ordering::SeqCst) {
        return;
    }

    let _ = app.emit(LOCKED_EVENT, ());

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Locks the window once the user has been away long enough, and does nothing while they are here.
pub fn lock_if_idle_long_enough<R: Runtime>(app: &AppHandle<R>, now_ms: i64) {
    let Some(state) = app.try_state::<WindowLock>() else {
        return;
    };
    let Some(since) = state.idle_since() else {
        return;
    };

    if now_ms - since >= state.after_idle_ms.load(Ordering::SeqCst) {
        lock(app);
    }
}

/// Watches for the user having been away long enough, on its own thread.
///
/// A thread rather than a timer the webview drives: a locked window's webview is showing the password
/// prompt and nothing else, and the whole point is that it is not trusted to decide this.
pub fn start<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(15));
        lock_if_idle_long_enough(&app, chrono::Utc::now().timestamp_millis());
    });
}

/// The state, after taking the user's own choice about the lock into account.
///
/// The setting is read here rather than at startup because this is the first thing the window asks, and
/// reading the database during `setup` would hold the app's launch behind it.
#[tauri::command]
pub async fn lock_state(db: State<'_, crate::state::Db>, state: State<'_, WindowLock>) -> TimetrackResult<LockState> {
    state.apply(&crate::store::lock_settings(&db).await);

    Ok(state.state())
}

#[tauri::command]
pub async fn lock_window<R: Runtime>(app: AppHandle<R>) -> TimetrackResult<()> {
    lock(&app);

    Ok(())
}

/// Checks the account password and, if it is right, shows the window again.
///
/// The check runs on a blocking thread because PAM sleeps for two seconds on a wrong password — that
/// delay is the rate limit, and holding the async runtime for it would stop every other command.
#[tauri::command]
pub async fn unlock_window<R: Runtime>(app: AppHandle<R>, password: Option<String>) -> TimetrackResult<bool> {
    let verified = tauri::async_runtime::spawn_blocking(move || auth::verify_owner(password.as_deref()))
        .await
        .map_err(|_| crate::error::TimetrackError::Rejected("the password check did not finish".into()))??;

    if !verified {
        return Ok(false);
    }

    if let Some(state) = app.try_state::<WindowLock>() {
        state.locked.store(false, Ordering::SeqCst);
        state.came_back();
    }

    crate::tray::reveal(&app);

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A restart is the easiest way past a lock that only engages later, so the app starts locked —
    /// but never on a machine that could not let the owner back in.
    #[test]
    fn starts_locked_exactly_where_the_password_can_be_checked() {
        assert_eq!(WindowLock::new().is_locked(), auth::can_verify());
    }

    fn off() -> LockSettings {
        LockSettings {
            enabled: false,
            ..LockSettings::default()
        }
    }

    #[test]
    fn reads_as_unlocked_once_the_user_turns_the_lock_off() {
        let lock = WindowLock::new();

        lock.apply(&off());

        assert!(!lock.is_locked());
    }

    #[test]
    fn never_locks_again_once_it_is_off() {
        let lock = WindowLock::new();

        lock.apply(&off());
        lock.went_idle(0);
        lock.locked.store(true, Ordering::SeqCst);

        assert!(!lock.is_locked());
    }

    #[test]
    fn waits_a_minute_after_the_user_goes_idle_unless_the_document_says_otherwise() {
        assert_eq!(LockSettings::read(&serde_json::json!({})).after_idle_ms, 60_000);
        assert_eq!(
            LockSettings::read(&serde_json::json!({ "lockAfterIdleMs": 300_000 })).after_idle_ms,
            300_000
        );
    }

    /// The host reads the document itself, so a hand-edit that asks for a day has to be held to the
    /// same range the core's own parser holds it to.
    #[test]
    fn holds_the_wait_inside_its_range_however_the_document_was_written() {
        assert_eq!(
            LockSettings::read(&serde_json::json!({ "lockAfterIdleMs": -1 })).after_idle_ms,
            0
        );
        assert_eq!(
            LockSettings::read(&serde_json::json!({ "lockAfterIdleMs": 86_400_000 })).after_idle_ms,
            MAX_LOCK_AFTER_IDLE_MS
        );
        assert_eq!(
            LockSettings::read(&serde_json::json!({ "lockAfterIdleMs": "soon" })).after_idle_ms,
            DEFAULT_LOCK_AFTER_IDLE_MS
        );
    }

    #[test]
    fn locks_by_default_and_only_stops_where_the_document_says_so() {
        assert!(LockSettings::read(&serde_json::json!({})).enabled);
        assert!(!LockSettings::read(&serde_json::json!({ "lockWindow": false })).enabled);
    }

    #[test]
    fn counts_nothing_towards_locking_while_the_user_is_present() {
        assert_eq!(WindowLock::new().idle_since(), None);
    }

    #[test]
    fn remembers_when_the_user_went_away_and_forgets_it_when_they_return() {
        let lock = WindowLock::new();

        lock.went_idle(1_000);
        assert_eq!(lock.idle_since(), Some(1_000));

        lock.came_back();
        assert_eq!(lock.idle_since(), None);
    }

    #[test]
    fn tells_the_webview_whether_it_has_to_ask_for_a_password_itself() {
        assert_eq!(WindowLock::new().state().prompts_itself, cfg!(any(target_os = "macos", target_os = "windows")));
    }
}
