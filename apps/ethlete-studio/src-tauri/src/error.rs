use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum StudioError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    /// The webview tells a missing CLI apart from every other failure by this exact prefix, so the
    /// UI can offer to install it rather than print an OS error nobody can act on.
    #[error("not installed: {0}")]
    NotInstalled(String),
    #[error("{0}")]
    Rejected(String),
    #[error("a lock was poisoned, so the host can no longer trust it; restart Studio")]
    Poisoned,
}

impl Serialize for StudioError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type StudioResult<T> = Result<T, StudioError>;
