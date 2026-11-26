use crate::error::{TimetrackError, TimetrackResult};
use crate::keychain;

/// The keychain accounts a window may name, which are the provider credentials the settings screen
/// collects and nothing else.
///
/// The app's own service holds more than those: `database-key` is the SQLCipher key, and every event
/// ever collected is behind it. Reading it from a window would hand the whole store to anything that
/// reaches this command, and writing or deleting it would leave the database unreadable at the next
/// start. `machine-key` is the private key a paired machine knows this one by; reading it would let
/// anything that reaches this command pose as this machine to every peer. Matching
/// `TIMETRACK_SECRET_KEYS` in the core.
const ACCOUNTS: [&str; 4] = [
    "jira-token",
    "tempo-token",
    "google-client-secret",
    "google-refresh-token",
];

/// Accounts an earlier version wrote. A window may delete them, which is how the core clears them on
/// start, but never read or write them. Matching `RETIRED_TIMETRACK_SECRET_KEYS` in the core.
const RETIRED: [&str; 1] = ["gitlab-token"];

fn rejected(account: &str) -> TimetrackError {
    TimetrackError::Rejected(format!("{account} is not a credential a window may reach"))
}

fn check(account: &str) -> TimetrackResult<()> {
    if ACCOUNTS.contains(&account) {
        return Ok(());
    }

    Err(rejected(account))
}

fn check_delete(account: &str) -> TimetrackResult<()> {
    if RETIRED.contains(&account) {
        return Ok(());
    }

    check(account)
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
    check_delete(&account)?;

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
        assert!(check("machine-key").is_err());
        assert!(check("").is_err());
        assert!(check("jira-token ").is_err());
        assert!(check_delete("database-key").is_err());
        assert!(check_delete("machine-key").is_err());
    }

    #[test]
    fn only_deletes_a_retired_account() {
        assert!(check("gitlab-token").is_err());
        assert!(check_delete("gitlab-token").is_ok());
        assert!(check_delete("jira-token").is_ok());
    }
}
