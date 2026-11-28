#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri_runtime_cef::cef_entry_point]
fn main() {
    ethlete_studio_lib::run();
}

#[cfg(target_os = "linux")]
#[no_mangle]
unsafe extern "C" fn sigaction(
    signal: std::ffi::c_int,
    action: *const libc::sigaction,
    previous: *mut libc::sigaction,
) -> std::ffi::c_int {
    ethlete_studio_lib::cef_signals::sigaction(signal, action, previous)
}
