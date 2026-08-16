mod db;
mod decorations;
#[cfg(target_os = "linux")]
mod decorations_wayland;
mod error;
mod git;
mod http;
mod keychain;
mod logs;
mod nudge;
mod oauth;
mod pause;
mod process;
mod secrets;
mod state;
mod store;
mod timer;
mod tray;
mod window;
#[cfg(target_os = "macos")]
mod window_macos;
#[cfg(target_os = "linux")]
mod window_wayland;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        // Single-instance has to be the first plugin registered, and it is what makes running the
        // binary a second time - `timetrack open` - focus the window instead of starting a rival
        // daemon. That is the only way in on a desktop whose bar hosts no tray.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            tray::reveal(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let key = keychain::database_key()?;
            let connection = db::open(&data_dir.join("timetrack.db"), &key)?;
            let paused = pause::paused_at(&connection)?.is_some();

            app.manage(state::Db::new(connection));
            app.manage(http::Http(
                reqwest::Client::builder()
                    .user_agent(concat!("ethlete-timetrack/", env!("CARGO_PKG_VERSION")))
                    .build()?,
            ));

            let windows = window::WindowSource::new();

            // Before the source starts, not after the webview has loaded and told us: a pause the
            // user took yesterday must not collect the first seconds of today's start.
            windows.set_paused(paused);
            window::start(&windows);
            app.manage(windows);
            app.manage(git::GitWatcher::new());
            app.manage(decorations::detect());

            tray::attach(app.handle())?;

            Ok(())
        })
        .on_window_event(tray::hide_instead_of_closing)
        .invoke_handler(tauri::generate_handler![
            decorations::window_capabilities,
            git::git_changes,
            git::git_repos,
            http::http_request,
            logs::agent_log_lines,
            logs::agent_logs,
            nudge::day_nudge_record,
            nudge::notify,
            nudge::set_day_nudge_record,
            oauth::oauth_authorize,
            pause::collection_set_paused,
            pause::collection_state,
            process::run_process,
            secrets::secret_delete,
            secrets::secret_has,
            secrets::secret_read,
            secrets::secret_write,
            store::agent_session_cursors,
            store::app_settings,
            store::compacted_through,
            store::day_review_edits,
            store::events_append,
            store::events_between,
            store::events_by_source,
            store::events_delete_before,
            store::events_oldest_at,
            store::ledger_entries_for_day,
            store::ledger_remove,
            store::ledger_upsert,
            store::set_app_settings,
            store::set_compacted_through,
            store::set_day_review_edits,
            timer::timer_label,
            timer::timer_running,
            timer::timer_runs_between,
            timer::timer_start,
            timer::timer_stop,
            tray::tray_set_readout,
            window::window_events,
            window::window_request_accessibility,
            window::window_source_status,
        ])
        .run(tauri::generate_context!())
        .expect("timetrack failed to start");
}
