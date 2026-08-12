use crate::error::{TimetrackError, TimetrackResult};
use keyring::Entry;

const SERVICE: &str = "io.ethlete.timetrack";
const DATABASE_KEY_ACCOUNT: &str = "database-key";

fn entry(account: &str) -> TimetrackResult<Entry> {
    Ok(Entry::new(SERVICE, account)?)
}

pub fn read_secret(account: &str) -> TimetrackResult<Option<String>> {
    match entry(account)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(TimetrackError::Keychain(error)),
    }
}

pub fn write_secret(account: &str, value: &str) -> TimetrackResult<()> {
    entry(account)?.set_password(value)?;
    Ok(())
}

/// The SQLCipher key as the 64 hex chars `PRAGMA key` wants, generated on first run.
///
/// Losing it makes the database unreadable, which is the intended failure mode: the events are the
/// user's workday, and there is no recovery path that does not also give one to somebody else.
pub fn database_key() -> TimetrackResult<String> {
    if let Some(existing) = read_secret(DATABASE_KEY_ACCOUNT)? {
        return Ok(existing);
    }

    let bytes: [u8; 32] = rand::random();
    let key = bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>();

    write_secret(DATABASE_KEY_ACCOUNT, &key)?;

    Ok(key)
}
