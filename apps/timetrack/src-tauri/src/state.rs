use crate::error::{TimetrackError, TimetrackResult};
use rusqlite::Connection;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Db(Arc<Mutex<Connection>>);

impl Db {
    pub fn new(connection: Connection) -> Self {
        Self(Arc::new(Mutex::new(connection)))
    }

    /// Runs `work` off the main thread, so a slow query cannot stall the webview.
    pub async fn run<T, F>(&self, work: F) -> TimetrackResult<T>
    where
        F: FnOnce(&mut Connection) -> TimetrackResult<T> + Send + 'static,
        T: Send + 'static,
    {
        let connection = self.0.clone();

        tauri::async_runtime::spawn_blocking(move || {
            let mut guard = connection.lock().map_err(|_| TimetrackError::Poisoned)?;
            work(&mut guard)
        })
        .await
        .map_err(|error| TimetrackError::Rejected(error.to_string()))?
    }
}
