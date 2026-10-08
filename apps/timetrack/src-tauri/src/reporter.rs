use crate::error::TimetrackResult;
use tauri::path::BaseDirectory;
use tauri::Manager;

/// Where `tools/scripts/stage-vscode-extension.mjs` puts the packaged reporter, and what
/// `bundle.resources` in `tauri.conf.json` ships. Renaming it there renames it here.
const REPORTER_VSIX: &str = "resources/timetrack-vscode.vsix";

/// The absolute path of the reporter extension this build ships, and `None` when it ships none.
///
/// A missing file is an answer rather than a failure: `bundle.resources` matches a glob, so a build
/// that skipped the staging step produces an app that works in every other way. The Sources view
/// falls back to naming the command for a checkout.
#[tauri::command]
pub fn reporter_vsix_path(app: tauri::AppHandle) -> TimetrackResult<Option<String>> {
    let Ok(path) = app.path().resolve(REPORTER_VSIX, BaseDirectory::Resource) else {
        return Ok(None);
    };

    Ok(path.exists().then(|| path.to_string_lossy().into_owned()))
}

/// Asks where to save a debug report and writes it there, answering the chosen path, or `None` when the
/// user dismissed the dialog.
#[tauri::command]
pub async fn save_report_file(
    app: tauri::AppHandle,
    suggested_name: String,
    text: String,
) -> TimetrackResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let Some(chosen) = app
        .dialog()
        .file()
        .set_file_name(suggested_name)
        .add_filter("JSON", &["json"])
        .blocking_save_file()
    else {
        return Ok(None);
    };
    let path = chosen
        .into_path()
        .map_err(|error| crate::error::TimetrackError::Rejected(error.to_string()))?;

    std::fs::write(&path, text)?;

    Ok(Some(path.to_string_lossy().into_owned()))
}
