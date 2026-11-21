use std::{
    ffi::{c_int, c_uint, c_void, CStr},
    sync::OnceLock,
};

type Prepare = unsafe extern "C" fn(*mut GSource, *mut c_int) -> c_int;

#[repr(C)]
struct GSourceFuncs {
    prepare: Option<Prepare>,
    check: *const c_void,
    dispatch: *const c_void,
    finalize: *const c_void,
    closure_callback: *const c_void,
    closure_marshal: *const c_void,
}

#[repr(C)]
struct GSource {
    callback_data: *mut c_void,
    callback_funcs: *const c_void,
    source_funcs: *const GSourceFuncs,
}

#[link(name = "glib-2.0")]
extern "C" {
    fn g_main_context_find_source_by_id(context: *mut c_void, id: c_uint) -> *mut GSource;
    fn g_timeout_source_new(interval: c_uint) -> *mut GSource;
    fn g_source_attach(source: *mut GSource, context: *mut c_void) -> c_uint;
    fn g_source_destroy(source: *mut GSource);
    fn g_source_unref(source: *mut GSource);
    fn g_source_get_priority(source: *mut GSource) -> c_int;
}

const G_PRIORITY_DEFAULT_IDLE: c_int = 200;

static CHROMIUM_PREPARE: OnceLock<usize> = OnceLock::new();

// Workaround for tauri-runtime-cef's Linux external message pump: Chromium's MessagePumpGlib work
// source on the default GLib context returns a zero timeout whenever its pump is outside Run(), which
// with an external pump is always, so the main loop never sleeps. CEF's external pump already
// schedules that work, so only that zero timeout is dropped.
/// Stops Chromium's GLib work source from keeping the main loop busy. Call once on the main thread
/// after CEF has initialized.
pub fn stop_busy_polling() {
    unsafe {
        let probe = g_timeout_source_new(c_uint::MAX);
        let newest = g_source_attach(probe, std::ptr::null_mut());

        g_source_destroy(probe);
        g_source_unref(probe);

        for id in 1..newest {
            let source = g_main_context_find_source_by_id(std::ptr::null_mut(), id);

            if !source.is_null() && is_chromium_work_source(source) {
                tame(source);
            }
        }
    }
}

unsafe fn is_chromium_work_source(source: *mut GSource) -> bool {
    let Some(prepare) = (unsafe { (*(*source).source_funcs).prepare }) else {
        return false;
    };

    let priority = unsafe { g_source_get_priority(source) };

    priority == G_PRIORITY_DEFAULT_IDLE
        && defined_in(prepare as *const c_void).is_some_and(|library| is_libcef(&library))
}

fn defined_in(address: *const c_void) -> Option<String> {
    let mut info = unsafe { std::mem::zeroed::<libc::Dl_info>() };

    if unsafe { libc::dladdr(address, &mut info) } == 0 || info.dli_fname.is_null() {
        return None;
    }

    Some(unsafe { CStr::from_ptr(info.dli_fname) }.to_string_lossy().into_owned())
}

fn is_libcef(library: &str) -> bool {
    library.rsplit('/').next() == Some("libcef.so")
}

unsafe fn tame(source: *mut GSource) {
    let original = unsafe { &*(*source).source_funcs };
    let Some(prepare) = original.prepare else {
        return;
    };

    if *CHROMIUM_PREPARE.get_or_init(|| prepare as usize) != prepare as usize {
        return;
    }

    let funcs = Box::leak(Box::new(GSourceFuncs {
        prepare: Some(prepare_without_busy_wait),
        check: original.check,
        dispatch: original.dispatch,
        finalize: original.finalize,
        closure_callback: original.closure_callback,
        closure_marshal: original.closure_marshal,
    }));

    unsafe { (*source).source_funcs = funcs };
}

unsafe extern "C" fn prepare_without_busy_wait(source: *mut GSource, timeout: *mut c_int) -> c_int {
    let prepare: Prepare = unsafe { std::mem::transmute(*CHROMIUM_PREPARE.get().unwrap()) };
    let ready = unsafe { prepare(source, timeout) };

    if !timeout.is_null() {
        unsafe { *timeout = poll_timeout(ready != 0, *timeout) };
    }

    ready
}

fn poll_timeout(ready: bool, timeout: c_int) -> c_int {
    if !ready && timeout == 0 {
        -1
    } else {
        timeout
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn waits_instead_of_spinning_when_the_source_is_idle_with_a_zero_timeout() {
        assert_eq!(poll_timeout(false, 0), -1);
    }

    #[test]
    fn keeps_a_real_delay_and_a_ready_source() {
        assert_eq!(poll_timeout(false, 16), 16);
        assert_eq!(poll_timeout(false, -1), -1);
        assert_eq!(poll_timeout(true, 0), 0);
    }

    extern "C" {
        fn g_main_context_new() -> *mut c_void;
        fn g_main_context_unref(context: *mut c_void);
        fn g_main_context_iteration(context: *mut c_void, may_block: c_int) -> c_int;
        fn g_source_new(funcs: *mut GSourceFuncs, size: c_uint) -> *mut GSource;
    }

    unsafe extern "C" fn idle_pump_prepare(_source: *mut GSource, timeout: *mut c_int) -> c_int {
        unsafe { *timeout = 0 };
        0
    }

    unsafe extern "C" fn never_ready(_source: *mut GSource) -> c_int {
        0
    }

    #[test]
    fn a_tamed_idle_pump_source_lets_the_loop_sleep() {
        unsafe {
            let context = g_main_context_new();
            let funcs = Box::leak(Box::new(GSourceFuncs {
                prepare: Some(idle_pump_prepare),
                check: never_ready as *const c_void,
                dispatch: std::ptr::null(),
                finalize: std::ptr::null(),
                closure_callback: std::ptr::null(),
                closure_marshal: std::ptr::null(),
            }));
            let pump = g_source_new(funcs, 128);
            g_source_attach(pump, context);
            let wake = g_timeout_source_new(40);
            g_source_attach(wake, context);

            let spun = std::time::Instant::now();
            g_main_context_iteration(context, 1);
            assert!(spun.elapsed() < std::time::Duration::from_millis(20));

            tame(pump);

            let slept = std::time::Instant::now();
            g_main_context_iteration(context, 1);
            assert!(slept.elapsed() >= std::time::Duration::from_millis(20));

            g_source_destroy(pump);
            g_source_unref(pump);
            g_source_destroy(wake);
            g_source_unref(wake);
            g_main_context_unref(context);
        }
    }

    #[test]
    fn recognises_libcef_by_file_name_only() {
        assert!(is_libcef("/opt/timetrack/libcef.so"));
        assert!(is_libcef("libcef.so"));
        assert!(!is_libcef("/usr/lib64/libglib-2.0.so.0"));
        assert!(!is_libcef("/opt/libcef.so.backup"));
    }
}
