mod db;
mod error;
mod http;
mod keychain;
mod process;
mod secrets;
mod state;
mod store;

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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            http::http_request,
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
        ])
        .run(tauri::generate_context!())
        .expect("timetrack failed to start");
}
