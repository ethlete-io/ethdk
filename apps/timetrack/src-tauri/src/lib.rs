mod db;
mod decorations;
#[cfg(target_os = "linux")]
mod decorations_wayland;
mod error;
mod http;
mod keychain;
mod logs;
mod process;
mod secrets;
mod state;
mod store;
mod tray;
mod window;
#[cfg(target_os = "linux")]
mod window_wayland;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let key = keychain::database_key()?;
            let connection = db::open(&data_dir.join("timetrack.db"), &key)?;

            app.manage(state::Db::new(connection));
            app.manage(http::Http(
                reqwest::Client::builder()
                    .user_agent(concat!("ethlete-timetrack/", env!("CARGO_PKG_VERSION")))
                    .build()?,
            ));

            let windows = window::WindowSource::new();

            window::start(&windows);
            app.manage(windows);
            app.manage(decorations::detect());

            tray::attach(app.handle())?;

            Ok(())
        })
        .on_window_event(tray::hide_instead_of_closing)
        .invoke_handler(tauri::generate_handler![
            decorations::window_capabilities,
            http::http_request,
            logs::agent_log_lines,
            logs::agent_logs,
            process::run_process,
            secrets::secret_read,
            secrets::secret_write,
            store::agent_session_cursors,
            store::compacted_through,
            store::events_append,
            store::events_between,
            store::events_delete_before,
            store::events_oldest_at,
            store::ledger_entries_for,
            store::ledger_remove,
            store::ledger_upsert,
            store::set_compacted_through,
            window::window_events,
            window::window_source_status,
        ])
        .run(tauri::generate_context!())
        .expect("timetrack failed to start");
}
