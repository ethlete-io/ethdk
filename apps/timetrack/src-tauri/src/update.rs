use std::sync::Mutex;

use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::error::{TimetrackError, TimetrackResult};

#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

fn rejected(error: tauri_plugin_updater::Error) -> TimetrackError {
    TimetrackError::Rejected(format!("update failed: {error}"))
}

/// Downloads a newer release, if there is one, and returns its version.
#[tauri::command]
pub async fn update_ready(app: AppHandle, pending: State<'_, PendingUpdate>) -> TimetrackResult<Option<String>> {
    // A debug build is a development copy: updating it would replace it with the last release.
    if cfg!(debug_assertions) {
        return Ok(None);
    }

    let Some(update) = app.updater().map_err(rejected)?.check().await.map_err(rejected)? else {
        return Ok(None);
    };
    let bytes = update.download(|_, _| {}, || {}).await.map_err(rejected)?;
    let version = update.version.clone();

    *pending.0.lock().map_err(|_| TimetrackError::Poisoned)? = Some((update, bytes));

    Ok(Some(version))
}

/// Installs what `update_ready` downloaded and restarts into it.
#[tauri::command]
pub async fn update_install(app: AppHandle, pending: State<'_, PendingUpdate>) -> TimetrackResult<()> {
    let taken = pending.0.lock().map_err(|_| TimetrackError::Poisoned)?.take();
    let Some((update, bytes)) = taken else {
        return Err(TimetrackError::Rejected("no update is downloaded".to_owned()));
    };

    update.install(bytes).map_err(rejected)?;
    app.request_restart();

    Ok(())
}
