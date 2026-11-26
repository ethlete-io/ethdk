#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri_runtime_cef::cef_entry_point]
fn main() {
    ethlete_studio_lib::run();
}
