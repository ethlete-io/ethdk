#[cfg(target_os = "linux")]
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "linux")]
const LARGE_BATCH: usize = 2_000;
// Tauri parses an IPC request and serializes its response outside the command, so the trim waits
// until both are freed.
#[cfg(target_os = "linux")]
const SETTLE: std::time::Duration = std::time::Duration::from_secs(2);

#[cfg(target_os = "linux")]
static TRIM_PENDING: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "linux")]
pub fn release_after(events: usize) {
    if events < LARGE_BATCH || TRIM_PENDING.swap(true, Ordering::AcqRel) {
        return;
    }

    std::thread::spawn(|| {
        std::thread::sleep(SETTLE);
        TRIM_PENDING.store(false, Ordering::Release);
        unsafe { libc::malloc_trim(0) };
    });
}

#[cfg(not(target_os = "linux"))]
pub fn release_after(_events: usize) {}
