use crate::child_env;
use crate::error::{StudioError, StudioResult};

const HELP_URL: &str = "https://github.com/ethlete-io/ethdk/tree/main/apps/ethlete-studio";

#[cfg(target_os = "macos")]
const OPENER: &str = "open";
#[cfg(target_os = "windows")]
const OPENER: &str = "explorer";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const OPENER: &str = "xdg-open";

/// Opens the Studio docs in the system browser.
#[tauri::command]
pub async fn help_open() -> StudioResult<()> {
    let status = child_env::command(OPENER).arg(HELP_URL).status().await?;

    if status.success() || cfg!(target_os = "windows") {
        return Ok(());
    }

    Err(StudioError::Rejected(format!(
        "{OPENER} could not open {HELP_URL}: {status}"
    )))
}
