use std::sync::atomic::{AtomicI32, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tokio::signal::unix::{signal, Signal, SignalKind};

use crate::design_server::{stop_every, DesignServers};

const WATCHDOG: Duration = Duration::from_secs(15);

static SIGNAL_EXIT_CODE: AtomicI32 = AtomicI32::new(0);

pub struct Signals {
    interrupt: Signal,
    terminate: Signal,
    hangup: Signal,
}

fn exit_code(kind: SignalKind) -> i32 {
    128 + kind.as_raw_value()
}

/// Installs the SIGINT, SIGTERM and SIGHUP handlers; a signal that arrives before `end_on` runs is
/// kept. Call it before the CEF runtime starts: CEF init resets these signals to their default, and
/// the runtime then restores only the handlers it found before init.
pub fn listen() -> Option<Signals> {
    tauri::async_runtime::block_on(async {
        Some(Signals {
            interrupt: signal(SignalKind::interrupt()).ok()?,
            terminate: signal(SignalKind::terminate()).ok()?,
            hangup: signal(SignalKind::hangup()).ok()?,
        })
    })
}

/// Ends the app on the first signal through its own exit path, so the design servers it started stop
/// with it. A main loop that does not reach the exit within fifteen seconds is ended by the watchdog.
pub fn end_on(signals: Option<Signals>, app: &AppHandle) {
    let Some(mut signals) = signals else {
        return;
    };
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        let kind = tokio::select! {
            _ = signals.interrupt.recv() => SignalKind::interrupt(),
            _ = signals.terminate.recv() => SignalKind::terminate(),
            _ = signals.hangup.recv() => SignalKind::hangup(),
        };
        let code = exit_code(kind);
        SIGNAL_EXIT_CODE.store(code, Ordering::SeqCst);

        let watched = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(WATCHDOG);
            stop_every(&watched.state::<DesignServers>());
            // SAFETY: _exit skips the exit handlers, which would run CEF's teardown while the main
            // thread is still inside cef::shutdown and can stall the exit.
            unsafe { libc::_exit(code) };
        });

        app.exit(code);
    });
}

/// Exits with the shell's code for the signal that ended the app, if one did.
pub fn exit_with_signal_code() {
    let code = SIGNAL_EXIT_CODE.load(Ordering::SeqCst);

    if code != 0 {
        std::process::exit(code);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_signal_exit_code_matches_the_shell_convention() {
        assert_eq!(exit_code(SignalKind::interrupt()), 130);
        assert_eq!(exit_code(SignalKind::terminate()), 143);
        assert_eq!(exit_code(SignalKind::hangup()), 129);
    }
}
