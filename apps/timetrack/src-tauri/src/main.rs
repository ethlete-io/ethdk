#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(target_os = "linux", target_env = "gnu"))]
mod cef_malloc;

#[cfg_attr(target_os = "linux", tauri_runtime_cef::cef_entry_point)]
fn main() {
    #[cfg(all(target_os = "linux", target_env = "gnu"))]
    cef_malloc::bound_retained_heap();
    timetrack_lib::run()
}
