#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg_attr(any(target_os = "linux", target_os = "macos"), tauri_runtime_cef::cef_entry_point)]
fn main() {
    ethlete_studio_lib::run();
}
