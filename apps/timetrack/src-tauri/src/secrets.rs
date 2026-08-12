use crate::error::{TimetrackError, TimetrackResult};
use crate::keychain;

#[tauri::command]
pub async fn secret_read(account: String) -> TimetrackResult<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || keychain::read_secret(&account))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[tauri::command]
pub async fn secret_write(account: String, value: String) -> TimetrackResult<()> {
    tauri::async_runtime::spawn_blocking(move || keychain::write_secret(&account, &value))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}
