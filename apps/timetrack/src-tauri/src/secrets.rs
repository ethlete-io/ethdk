use crate::error::{TimetrackError, TimetrackResult};
use crate::keychain;

/// The keychain accounts a window may name, which are the provider credentials the settings screen
/// collects and nothing else.
///
/// The app's own service holds more than those: `database-key` is the SQLCipher key, and every event
/// ever collected is behind it. Reading it from a window would hand the whole store to anything that
/// reaches this command, and writing or deleting it would leave the database unreadable at the next
/// start. Matching `TIMETRACK_SECRET_KEYS` in the core.
const ACCOUNTS: [&str; 5] = [
    "jira-token",
    "tempo-token",
    "google-client-secret",
    "google-refresh-token",
    "gitlab-token",
];

fn check(account: &str) -> TimetrackResult<()> {
    if ACCOUNTS.contains(&account) {
        return Ok(());
    }

    Err(TimetrackError::Rejected(format!(
        "{account} is not a credential a window may reach"
    )))
}

#[tauri::command]
pub async fn secret_read(account: String) -> TimetrackResult<Option<String>> {
    check(&account)?;

    tauri::async_runtime::spawn_blocking(move || keychain::read_secret(&account))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[tauri::command]
pub async fn secret_write(account: String, value: String) -> TimetrackResult<()> {
    check(&account)?;

    tauri::async_runtime::spawn_blocking(move || keychain::write_secret(&account, &value))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[tauri::command]
pub async fn secret_has(account: String) -> TimetrackResult<bool> {
    check(&account)?;

    tauri::async_runtime::spawn_blocking(move || keychain::has_secret(&account))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[tauri::command]
pub async fn secret_delete(account: String) -> TimetrackResult<()> {
    check(&account)?;

    tauri::async_runtime::spawn_blocking(move || keychain::delete_secret(&account))
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reaches_the_provider_credentials_the_settings_screen_collects() {
        assert!(check("jira-token").is_ok());
        assert!(check("google-refresh-token").is_ok());
    }

    /// The key the whole store is encrypted with is in the same keychain service as the tokens.
    #[test]
    fn never_reaches_the_database_key() {
        assert!(check("database-key").is_err());
        assert!(check("").is_err());
        assert!(check("jira-token ").is_err());
    }
}
