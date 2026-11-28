use std::ffi::{c_int, c_void};
use std::sync::atomic::{AtomicBool, AtomicPtr, Ordering};

type Sigaction = unsafe extern "C" fn(c_int, *const libc::sigaction, *mut libc::sigaction) -> c_int;

static HOLD: AtomicBool = AtomicBool::new(false);
static LIBC_SIGACTION: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

/// Keeps the installed SIGINT, SIGTERM and SIGHUP handlers until `release`.
pub fn hold() {
    HOLD.store(true, Ordering::SeqCst);
}

pub fn release() {
    HOLD.store(false, Ordering::SeqCst);
}

/// Workaround: `cef::initialize` resets SIGINT, SIGTERM and SIGHUP to their default and then
/// installs Chromium's shutdown handlers, which never end the tauri event loop; tauri-runtime-cef
/// restores the host's handlers only after it returns, so a signal in between kills the host
/// without its exit path or is swallowed. The executable exports this as `sigaction`, so libcef's
/// calls land here and leave the host's handlers in place while `hold` is on.
///
/// # Safety
///
/// Same contract as libc's `sigaction`.
pub unsafe fn sigaction(signal: c_int, action: *const libc::sigaction, previous: *mut libc::sigaction) -> c_int {
    let libc_sigaction = libc_sigaction();

    if !action.is_null() && matches!(signal, libc::SIGINT | libc::SIGTERM | libc::SIGHUP) && HOLD.load(Ordering::SeqCst)
    {
        return libc_sigaction(signal, std::ptr::null(), previous);
    }

    libc_sigaction(signal, action, previous)
}

fn libc_sigaction() -> Sigaction {
    let mut found = LIBC_SIGACTION.load(Ordering::Acquire);

    if found.is_null() {
        // SAFETY: RTLD_NEXT from the executable resolves to the next definition, libc's.
        found = unsafe { libc::dlsym(libc::RTLD_NEXT, c"sigaction".as_ptr()) };
        assert!(!found.is_null(), "libc has no sigaction");
        LIBC_SIGACTION.store(found, Ordering::Release);
    }

    // SAFETY: the symbol is libc's sigaction, whose signature Sigaction matches.
    unsafe { std::mem::transmute::<*mut c_void, Sigaction>(found) }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn handler_of(signal: c_int) -> libc::sighandler_t {
        let mut current: libc::sigaction = unsafe { std::mem::zeroed() };
        unsafe { sigaction(signal, std::ptr::null(), &mut current) };
        current.sa_sigaction
    }

    fn set(signal: c_int, handler: libc::sighandler_t) -> c_int {
        let mut action: libc::sigaction = unsafe { std::mem::zeroed() };
        action.sa_sigaction = handler;
        unsafe { sigaction(signal, &action, std::ptr::null_mut()) }
    }

    #[test]
    fn a_hold_keeps_the_termination_handlers_and_passes_other_signals() {
        set(libc::SIGHUP, libc::SIG_IGN);
        set(libc::SIGUSR2, libc::SIG_DFL);

        hold();
        let held = set(libc::SIGHUP, libc::SIG_DFL);
        set(libc::SIGUSR2, libc::SIG_IGN);
        let hup_during_hold = handler_of(libc::SIGHUP);
        let usr2_during_hold = handler_of(libc::SIGUSR2);
        release();
        set(libc::SIGHUP, libc::SIG_DFL);

        assert_eq!(held, 0);
        assert_eq!(hup_during_hold, libc::SIG_IGN);
        assert_eq!(usr2_during_hold, libc::SIG_IGN);
        assert_eq!(handler_of(libc::SIGHUP), libc::SIG_DFL);
        set(libc::SIGUSR2, libc::SIG_DFL);
    }
}
