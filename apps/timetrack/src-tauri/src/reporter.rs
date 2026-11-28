use crate::error::TimetrackResult;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::Manager;

/// Where `tools/scripts/stage-vscode-extension.mjs` puts the packaged reporter, and what
/// `bundle.resources` in `tauri.conf.json` ships. Renaming it there renames it here.
const REPORTER_VSIX: &str = "resources/timetrack-vscode.vsix";

const AGENT_MCP: &str = "resources/timetrack-mcp.mjs";

/// `tauri dev` copies no `bundle.resources` next to the debug binary, so a debug build also looks
/// where the staging scripts put the files.
fn shipped_resource(resolved: Option<PathBuf>, relative: &str) -> Option<String> {
    let staged = cfg!(debug_assertions).then(|| Path::new(env!("CARGO_MANIFEST_DIR")).join(relative));

    resolved
        .into_iter()
        .chain(staged)
        .find(|path| path.exists())
        .map(|path| path.to_string_lossy().into_owned())
}

/// The absolute path of the reporter extension this build ships, and `None` when it ships none.
///
/// A missing file is an answer rather than a failure: `bundle.resources` matches a glob, so a build
/// that skipped the staging step produces an app that works in every other way. The Sources view
/// falls back to naming the command for a checkout.
#[tauri::command]
pub fn reporter_vsix_path(app: tauri::AppHandle) -> TimetrackResult<Option<String>> {
    Ok(shipped_resource(
        app.path().resolve(REPORTER_VSIX, BaseDirectory::Resource).ok(),
        REPORTER_VSIX,
    ))
}

/// The absolute path of the bundled MCP stdio adapter, and `None` when this build ships none.
#[tauri::command]
pub fn agent_mcp_path(app: tauri::AppHandle) -> TimetrackResult<Option<String>> {
    Ok(shipped_resource(
        app.path().resolve(AGENT_MCP, BaseDirectory::Resource).ok(),
        AGENT_MCP,
    ))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_debug_build_finds_a_staged_resource_that_tauri_dev_did_not_copy() {
        let missing = std::env::temp_dir().join("timetrack-no-copied-resource/timetrack-mcp.mjs");
        let staged = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/.gitignore");

        assert_eq!(
            shipped_resource(Some(missing), "resources/.gitignore"),
            Some(staged.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn a_resource_the_bundle_holds_wins_over_the_staged_one() {
        let staged = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/.gitignore");
        let bundled = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");

        assert_eq!(
            shipped_resource(Some(bundled.clone()), "resources/.gitignore"),
            Some(bundled.to_string_lossy().into_owned())
        );
        assert!(staged.exists());
    }
}
