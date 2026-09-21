mod agent;
mod auth;
mod calls;
#[cfg(target_os = "linux")]
mod calls_linux;
#[cfg(target_os = "macos")]
mod calls_macos;
mod db;
mod decorations;
#[cfg(target_os = "linux")]
mod decorations_wayland;
mod discovery;
mod error;
mod git;
mod http;
mod ingest;
mod keychain;
mod lock;
#[cfg(target_os = "linux")]
mod lock_linux;
#[cfg(target_os = "macos")]
mod lock_macos;
mod logs;
mod nudge;
mod oauth;
mod pause;
mod placement;
mod process;
mod recovery;
mod reporter;
mod samples;
mod secrets;
mod spec;
mod state;
mod store;
mod timer;
mod tray;
mod widget;
mod window;
#[cfg(target_os = "macos")]
mod window_macos;
#[cfg(target_os = "linux")]
mod window_wayland;

use tauri::Manager;

pub fn run() {
    // A Finder/Dock launch gets launchd's bare PATH, not the login shell's, so `run_process` cannot
    // find `claude`/`codex`/`git` outside /usr/bin. This reads the PATH from the user's shell; if
    // that fails the app still runs, only PATH-dependent spawns stay degraded.
    if let Err(error) = fix_path_env::fix() {
        eprintln!("could not adopt the login shell's PATH: {error}");
    }

    tauri::Builder::default()
        // Single-instance has to be the first plugin registered, and it is what makes running the
        // binary a second time - `timetrack open` - focus the window instead of starting a rival
        // daemon. That is the only way in on a desktop whose bar hosts no tray.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            tray::reveal(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Before the database: the window is declared invisible so its stored size and position
            // can be applied before it is drawn, and a keychain that asks for a password must not be
            // what the window waits on to appear at all.
            app.manage(placement::Remembered::new(placement::restore(app.handle())));

            let data_dir = app.path().app_data_dir()?;
            let key = keychain::database_key()?;
            let store = data_dir.join("timetrack.db");

            // A store that cannot be opened leaves the rest of this unwired: every source below needs
            // somewhere to write, so none of them may start. The dialog decides what happens next.
            let connection = match db::open(&store, &key) {
                Ok(connection) => connection,
                Err(error) => {
                    recovery::offer_a_fresh_start(app.handle(), store, error.to_string());
                    return Ok(());
                }
            };
            let paused = pause::paused_at(&connection)?.is_some();

            app.manage(state::Db::new(connection));
            app.manage(http::Http(http::client()?));

            let window_lock = lock::WindowLock::new();
            let windows = window::WindowSource::new(window_lock.clone());
            let reporters = ingest::IngestSource::new();
            let calls = calls::CallSource::new();

            app.manage(window_lock);
            lock::start(app.handle().clone());

            #[cfg(target_os = "linux")]
            lock_linux::start(app.handle().clone());

            #[cfg(target_os = "macos")]
            lock_macos::start(app.handle().clone());

            // Before the sources start, not after the webview has loaded and told us: a pause the
            // user took yesterday must not collect the first seconds of today's start.
            windows.set_paused(paused);
            reporters.set_paused(paused);
            calls.set_paused(paused);
            window::start(&windows);
            ingest::start(reporters.clone(), data_dir.clone());
            calls::start(&calls);
            app.manage(windows);
            app.manage(reporters);
            app.manage(calls);

            let agents = agent::AgentEndpoint::new();

            agent::start(agents.clone(), app.handle().clone(), data_dir.clone());
            app.manage(agents);
            app.manage(git::GitWatcher::new());
            app.manage(decorations::detect());

            tray::attach(app.handle())?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Before the hide: a hidden window no longer reports where it was or how big it was.
            placement::remember(window, event);
            tray::hide_instead_of_closing(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            agent::agent_reply,
            agent::agent_status,
            calls::call_events,
            calls::call_source_status,
            decorations::window_capabilities,
            git::git_changes,
            git::git_repos,
            http::http_request,
            ingest::ingest_events,
            ingest::ingest_status,
            lock::lock_state,
            lock::lock_window,
            lock::unlock_window,
            logs::agent_log_lines,
            logs::agent_logs,
            nudge::day_nudge_record,
            nudge::notify,
            nudge::set_day_nudge_record,
            oauth::oauth_authorize,
            pause::collection_set_paused,
            pause::collection_state,
            process::run_process,
            reporter::reporter_vsix_path,
            secrets::secret_delete,
            secrets::secret_has,
            secrets::secret_read,
            secrets::secret_write,
            spec::read_spec,
            store::agent_session_cursors,
            store::app_settings,
            store::compacted_through,
            store::day_review_edits,
            store::day_review_edits_between,
            store::events_append,
            store::events_between,
            store::events_by_source,
            store::events_delete_before,
            store::events_oldest_at,
            store::events_set_titles,
            store::events_titles_after,
            store::ledger_entries_for_day,
            store::ledger_remove,
            store::ledger_upsert,
            store::set_app_settings,
            store::set_compacted_through,
            store::set_day_review_edits,
            store::set_tempo_coverage,
            store::tempo_coverage_for_day,
            timer::timer_label,
            timer::timer_running,
            timer::timer_runs_between,
            timer::timer_start,
            timer::timer_stop,
            tray::tray_set_readout,
            widget::widget_close,
            widget::widget_is_open,
            widget::widget_open,
            widget::widget_reveal_app,
            window::window_events,
            window::window_request_accessibility,
            window::window_source_status,
        ])
        .build(tauri::generate_context!())
        .expect("timetrack failed to start")
        .run(|app, event| {
            // A quit from the tray passes through no close, so this is the only place a resize made
            // since the window was last put away is written.
            if matches!(event, tauri::RunEvent::Exit) {
                placement::persist(app);

                // The token in these files outlives nothing: what binds the freed port next would
                // otherwise be asked the same questions, with the same bearer token attached.
                if let Ok(data_dir) = app.path().app_data_dir() {
                    discovery::forget(&agent::discovery_path(&data_dir));
                    discovery::forget(&ingest::discovery_path(&data_dir));
                }
            }
        });
}

#[cfg(test)]
mod capability_tests {
    /// A command reaches a window only when three lists agree: `generate_handler!` above,
    /// `COMMANDS` in `build.rs`, and the `allow-*` entries in `capabilities/default.json`. Nothing
    /// in the build fails when one of them falls behind - the command is simply refused at runtime -
    /// so this test is what catches it.
    const HANDLER: &str = include_str!("lib.rs");
    const BUILD: &str = include_str!("../build.rs");
    const DEFAULT_CAPABILITY: &str = include_str!("../capabilities/default.json");

    fn between<'a>(source: &'a str, start: &str, end: &str) -> &'a str {
        let rest = source.split_once(start).expect("opening marker").1;

        rest.split_once(end).expect("closing marker").0
    }

    fn registered() -> Vec<String> {
        let mut names = between(HANDLER, "generate_handler![", "])")
            .lines()
            .filter_map(|line| line.trim().strip_suffix(',').map(str::to_owned))
            .map(|name| name.rsplit("::").next().expect("a command name").to_owned())
            .collect::<Vec<_>>();

        names.sort();
        names
    }

    fn declared() -> Vec<String> {
        let mut names = between(BUILD, "const COMMANDS: &[&str] = &[", "];")
            .lines()
            .filter_map(|line| line.trim().trim_end_matches(',').strip_prefix('"').map(str::to_owned))
            .map(|name| name.trim_end_matches('"').to_owned())
            .collect::<Vec<_>>();

        names.sort();
        names
    }

    fn allowed() -> Vec<String> {
        let capability: serde_json::Value =
            serde_json::from_str(DEFAULT_CAPABILITY).expect("the default capability is valid JSON");
        let mut names = capability["permissions"]
            .as_array()
            .expect("a permissions array")
            .iter()
            .filter_map(|entry| entry.as_str())
            .filter_map(|entry| entry.strip_prefix("allow-"))
            .map(|entry| entry.replace('-', "_"))
            .collect::<Vec<_>>();

        names.sort();
        names
    }

    #[test]
    fn build_declares_every_registered_command() {
        assert_eq!(declared(), registered());
    }

    #[test]
    fn the_app_window_is_allowed_every_registered_command() {
        assert_eq!(allowed(), registered());
    }

    #[test]
    fn the_widget_is_allowed_less_than_the_app_window() {
        let widget: serde_json::Value = serde_json::from_str(include_str!("../capabilities/widget.json"))
            .expect("the widget capability is valid JSON");
        let widget_commands = widget["permissions"]
            .as_array()
            .expect("a permissions array")
            .iter()
            .filter_map(|entry| entry.as_str())
            .filter(|entry| entry.starts_with("allow-"))
            .count();

        assert!(widget_commands > 0);
        assert!(widget_commands < registered().len());
    }
}
