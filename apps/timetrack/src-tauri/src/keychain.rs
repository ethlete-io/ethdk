use crate::error::{TimetrackError, TimetrackResult};
use keyring::Entry;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, PoisonError};

const SERVICE: &str = "io.ethlete.timetrack";
const DATABASE_KEY_ACCOUNT: &str = "database-key";

fn entry(account: &str) -> TimetrackResult<Entry> {
    Ok(Entry::new(SERVICE, account)?)
}

/// What the keychain answered for each account this run, including the accounts that hold nothing.
///
/// macOS asks for the login password on every read of an item whose ACL does not name this binary, and
/// an unsigned build never matches one. Nine places read the Jira token, and the GitLab collector reads
/// its own every ten minutes. This holds each account to one read per run, so the prompts stop once the
/// app has started. A wrong entry here would report a token the keychain no longer holds, so every
/// write and every delete must keep it current.
static CACHE: Mutex<Option<HashMap<String, Option<String>>>> = Mutex::new(None);

fn cache() -> MutexGuard<'static, Option<HashMap<String, Option<String>>>> {
    CACHE.lock().unwrap_or_else(PoisonError::into_inner)
}

fn cached(account: &str) -> Option<Option<String>> {
    cache().as_ref().and_then(|held| held.get(account).cloned())
}

fn remember(account: &str, value: Option<String>) {
    cache()
        .get_or_insert_with(HashMap::new)
        .insert(account.to_owned(), value);
}

/// Whether a write of this value removes the entry instead of storing it.
///
/// `has_secret` answers from the entry's presence alone on macOS, where reading the value would cost a
/// password prompt. An entry that held an empty string would report a provider as configured, so
/// nothing may store one.
fn removes_the_entry(value: &str) -> bool {
    value.trim().is_empty()
}

pub fn read_secret(account: &str) -> TimetrackResult<Option<String>> {
    if let Some(held) = cached(account) {
        return Ok(held);
    }

    let value = match entry(account)?.get_password() {
        Ok(value) => Some(value),
        Err(keyring::Error::NoEntry) => None,
        Err(error) => return Err(TimetrackError::Keychain(error)),
    };

    remember(account, value.clone());

    Ok(value)
}

/// Stores a secret, or removes the entry when the value is empty. See `removes_the_entry`.
pub fn write_secret(account: &str, value: &str) -> TimetrackResult<()> {
    if removes_the_entry(value) {
        return delete_secret(account);
    }

    entry(account)?.set_password(value)?;
    remember(account, Some(value.to_owned()));

    Ok(())
}

/// Whether a secret is stored, so a settings screen can report a provider as configured without the
/// value ever reaching the window.
pub fn has_secret(account: &str) -> TimetrackResult<bool> {
    if let Some(held) = cached(account) {
        return Ok(held.is_some_and(|value| !value.trim().is_empty()));
    }

    platform::has_secret(account)
}

/// Removes a secret. An account that holds nothing is already in the state this asks for, so a missing
/// entry is a success rather than an error.
pub fn delete_secret(account: &str) -> TimetrackResult<()> {
    match entry(account)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {
            remember(account, None);

            Ok(())
        }
        Err(error) => Err(TimetrackError::Keychain(error)),
    }
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

#[cfg(target_os = "macos")]
mod platform {
    use crate::error::{TimetrackError, TimetrackResult};
    use security_framework::item::{ItemClass, ItemSearchOptions};

    /// `errSecItemNotFound`, which is how a search reports that the account holds nothing.
    const NOT_FOUND: i32 = -25300;

    /// Whether the entry exists, asked without the secret being read.
    ///
    /// Reading the secret needs the item's ACL to name this binary, and that is what makes macOS ask
    /// for the login password. An attribute search needs no such approval, so this puts up no prompt.
    /// The keychain is left to the default search list, which is the login keychain `keyring` writes
    /// to.
    pub fn has_secret(account: &str) -> TimetrackResult<bool> {
        let mut options = ItemSearchOptions::new();

        options
            .class(ItemClass::generic_password())
            .service(super::SERVICE)
            .account(account)
            .load_attributes(true)
            .limit(1);

        match options.search() {
            Ok(found) => Ok(!found.is_empty()),
            Err(error) if error.code() == NOT_FOUND => Ok(false),
            Err(error) => Err(TimetrackError::Rejected(error.to_string())),
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod platform {
    use crate::error::TimetrackResult;

    /// Nothing outside macOS charges a password prompt for a read, so the value answers this.
    pub fn has_secret(account: &str) -> TimetrackResult<bool> {
        Ok(super::read_secret(account)?.is_some_and(|value| !value.trim().is_empty()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// An empty token is how a settings field reads when the user clears it, and it must leave the
    /// keychain in the same state the forget button does.
    #[test]
    fn treats_a_write_of_nothing_as_a_removal() {
        assert!(removes_the_entry(""));
        assert!(removes_the_entry("   "));
        assert!(removes_the_entry("\n\t"));
    }

    #[test]
    fn stores_a_value_that_holds_anything_at_all() {
        assert!(!removes_the_entry("x"));
        assert!(!removes_the_entry("  token  "));
    }
}
