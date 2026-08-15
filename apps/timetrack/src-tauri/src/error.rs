use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum TimetrackError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("keychain error: {0}")]
    Keychain(#[from] keyring::Error),
    #[error("request error: {0}")]
    Request(#[from] reqwest::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("host error: {0}")]
    Host(#[from] tauri::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("notification error: {0}")]
    Notification(#[from] tauri_plugin_notification::Error),
    #[error("{0}")]
    Rejected(String),
    #[error("the database lock was poisoned, so the app can no longer trust it; restart")]
    Poisoned,
}

impl Serialize for TimetrackError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type TimetrackResult<T> = Result<T, TimetrackError>;
