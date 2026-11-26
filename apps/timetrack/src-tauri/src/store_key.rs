use crate::error::{TimetrackError, TimetrackResult};
use crate::keychain::{DATABASE_KEY_ACCOUNT, SERVICE};
use aws_lc_rs::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM, NONCE_LEN};
use aws_lc_rs::pbkdf2;
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::path::Path;

/// The keyring service the app reads its store key from.
pub const DEFAULT_SERVICE: &str = SERVICE;

const FORMAT: &str = "timetrack-store-key";
const VERSION: u32 = 1;
const KDF: &str = "pbkdf2-hmac-sha256";
const CIPHER: &str = "aes-256-gcm";
const ITERATIONS: u32 = 600_000;
/// A file asking for fewer rounds was not written by `seal`, and one asking for more would stall the
/// import on a value an attacker chose.
const ITERATION_RANGE: std::ops::RangeInclusive<u32> = ITERATIONS..=10_000_000;
const SALT_LEN: usize = 16;
const MIN_PASSPHRASE_CHARS: usize = 12;

#[derive(Serialize, Deserialize)]
struct SealedKey {
    format: String,
    version: u32,
    kdf: String,
    iterations: u32,
    salt: String,
    cipher: String,
    nonce: String,
    ciphertext: String,
}

impl SealedKey {
    /// Every header field is bound into the tag, so a file whose parameters were edited fails to open
    /// instead of being decrypted under the edited ones.
    fn header(&self) -> String {
        format!(
            "{}:{}:{}:{}:{}:{}:{}",
            self.format, self.version, self.kdf, self.iterations, self.salt, self.cipher, self.nonce
        )
    }
}

fn rejected(message: impl Into<String>) -> TimetrackError {
    TimetrackError::Rejected(message.into())
}

fn cipher_key(passphrase: &str, salt: &[u8], iterations: u32) -> TimetrackResult<LessSafeKey> {
    let iterations = NonZeroU32::new(iterations).ok_or_else(|| rejected("the iteration count is zero"))?;
    let mut derived = [0u8; 32];

    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        salt,
        passphrase.as_bytes(),
        &mut derived,
    );

    let unbound = UnboundKey::new(&AES_256_GCM, &derived).map_err(|_| rejected("the derived key was refused"))?;

    Ok(LessSafeKey::new(unbound))
}

fn random<const N: usize>() -> TimetrackResult<[u8; N]> {
    let mut bytes = [0u8; N];

    aws_lc_rs::rand::fill(&mut bytes).map_err(|_| rejected("the system random source failed"))?;

    Ok(bytes)
}

fn is_store_key(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

/// Encrypts a store key under a passphrase into the JSON text of a key file.
pub fn seal(store_key: &str, passphrase: &str) -> TimetrackResult<String> {
    if !is_store_key(store_key) {
        return Err(rejected("the keyring entry does not hold a store key"));
    }

    if passphrase.chars().count() < MIN_PASSPHRASE_CHARS {
        return Err(rejected(format!(
            "the passphrase needs at least {MIN_PASSPHRASE_CHARS} characters"
        )));
    }

    let salt: [u8; SALT_LEN] = random()?;
    let nonce: [u8; NONCE_LEN] = random()?;
    let mut sealed = SealedKey {
        format: FORMAT.into(),
        version: VERSION,
        kdf: KDF.into(),
        iterations: ITERATIONS,
        salt: BASE64.encode(salt),
        cipher: CIPHER.into(),
        nonce: BASE64.encode(nonce),
        ciphertext: String::new(),
    };
    let mut in_out = store_key.as_bytes().to_vec();

    cipher_key(passphrase, &salt, ITERATIONS)?
        .seal_in_place_append_tag(
            Nonce::assume_unique_for_key(nonce),
            Aad::from(sealed.header()),
            &mut in_out,
        )
        .map_err(|_| rejected("the store key could not be encrypted"))?;

    sealed.ciphertext = BASE64.encode(in_out);

    Ok(serde_json::to_string_pretty(&sealed)?)
}

/// Decrypts the JSON text of a key file back into the store key.
pub fn unseal(file: &str, passphrase: &str) -> TimetrackResult<String> {
    let sealed: SealedKey =
        serde_json::from_str(file).map_err(|_| rejected("this is not a Timetrack store key file"))?;

    if sealed.format != FORMAT {
        return Err(rejected("this is not a Timetrack store key file"));
    }

    if sealed.version != VERSION {
        return Err(rejected(format!(
            "the key file is version {}, and this build reads version {VERSION}",
            sealed.version
        )));
    }

    if sealed.kdf != KDF || sealed.cipher != CIPHER || !ITERATION_RANGE.contains(&sealed.iterations) {
        return Err(rejected("the key file names parameters this build does not accept"));
    }

    let decode = |field: &str| BASE64.decode(field).map_err(|_| rejected("the key file is damaged"));
    let salt = decode(&sealed.salt)?;
    let nonce: [u8; NONCE_LEN] = decode(&sealed.nonce)?
        .try_into()
        .map_err(|_| rejected("the key file is damaged"))?;
    let mut in_out = decode(&sealed.ciphertext)?;
    let opened = cipher_key(passphrase, &salt, sealed.iterations)?
        .open_in_place(
            Nonce::assume_unique_for_key(nonce),
            Aad::from(sealed.header()),
            &mut in_out,
        )
        .map_err(|_| rejected("wrong passphrase, or the key file was changed"))?;
    let store_key = String::from_utf8(opened.to_vec()).map_err(|_| rejected("the key file is damaged"))?;

    if !is_store_key(&store_key) {
        return Err(rejected("the key file does not hold a store key"));
    }

    Ok(store_key)
}

fn store_key_entry(service: &str) -> TimetrackResult<keyring::Entry> {
    Ok(keyring::Entry::new(service, DATABASE_KEY_ACCOUNT)?)
}

/// Writes the store key of `service`, encrypted under `passphrase`, to a new file at `path`.
///
/// Reads the keyring and nothing else: a missing entry is an error, never a generated key.
pub fn export(service: &str, passphrase: &str, path: &Path) -> TimetrackResult<()> {
    let store_key = match store_key_entry(service)?.get_password() {
        Ok(value) => value,
        Err(keyring::Error::NoEntry) => {
            return Err(rejected(format!("the keyring holds no store key for {service}")));
        }
        Err(error) => return Err(error.into()),
    };
    let sealed = seal(&store_key, passphrase)?;

    let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(path)?;

    std::io::Write::write_all(&mut file, sealed.as_bytes())?;

    Ok(())
}

/// Decrypts the key file at `path` and stores the key as the store key of `service`.
///
/// An entry that already holds a different key is only replaced with `replace`, since the store it
/// opens becomes unreadable.
pub fn import(service: &str, passphrase: &str, path: &Path, replace: bool) -> TimetrackResult<()> {
    let store_key = unseal(&std::fs::read_to_string(path)?, passphrase)?;
    let entry = store_key_entry(service)?;

    match entry.get_password() {
        Ok(existing) if existing == store_key => return Ok(()),
        Ok(_) if !replace => {
            return Err(rejected(format!(
                "{service} already holds a different store key; pass --replace to overwrite it"
            )));
        }
        Ok(_) | Err(keyring::Error::NoEntry) => {}
        Err(error) => return Err(error.into()),
    }

    entry.set_password(&store_key)?;

    Ok(())
}

/// Opens the store in `data_dir` with the store key of `service` and counts the events of each
/// source between the two instants, the way the app reads a day.
pub fn check(service: &str, data_dir: &Path, from_ms: i64, to_ms: i64) -> TimetrackResult<Vec<(String, usize)>> {
    let store_key = store_key_entry(service)?.get_password()?;
    let connection = crate::db::open(&data_dir.join("timetrack.db"), &store_key)?;
    let mut tally = std::collections::BTreeMap::<String, usize>::new();

    for event in crate::store::read_events_between(&connection, from_ms, to_ms)? {
        *tally.entry(event.source).or_default() += 1;
    }

    Ok(tally.into_iter().collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    const PASSPHRASE: &str = "correct horse battery staple";

    fn edited(file: &str, edit: impl FnOnce(&mut serde_json::Value)) -> String {
        let mut value: serde_json::Value = serde_json::from_str(file).unwrap();

        edit(&mut value);

        value.to_string()
    }

    #[test]
    fn opens_what_it_sealed() {
        let file = seal(KEY, PASSPHRASE).unwrap();

        assert!(!file.contains(KEY));
        assert_eq!(unseal(&file, PASSPHRASE).unwrap(), KEY);
    }

    #[test]
    fn refuses_a_wrong_passphrase() {
        let file = seal(KEY, PASSPHRASE).unwrap();

        assert!(unseal(&file, "correct horse battery stapler").is_err());
    }

    #[test]
    fn refuses_a_tampered_ciphertext() {
        let file = seal(KEY, PASSPHRASE).unwrap();
        let tampered = edited(&file, |value| {
            let mut bytes = BASE64.decode(value["ciphertext"].as_str().unwrap()).unwrap();
            bytes[0] ^= 1;
            value["ciphertext"] = BASE64.encode(bytes).into();
        });

        assert!(unseal(&tampered, PASSPHRASE).is_err());
    }

    #[test]
    fn refuses_a_tampered_header() {
        let file = seal(KEY, PASSPHRASE).unwrap();
        let tampered = edited(&file, |value| value["iterations"] = (ITERATIONS + 1).into());

        assert!(unseal(&tampered, PASSPHRASE).is_err());
    }

    #[test]
    fn refuses_another_version() {
        let file = seal(KEY, PASSPHRASE).unwrap();
        let newer = edited(&file, |value| value["version"] = (VERSION + 1).into());
        let error = unseal(&newer, PASSPHRASE).unwrap_err().to_string();

        assert!(error.contains("version 2"), "{error}");
    }

    #[test]
    fn refuses_a_file_of_another_kind() {
        let file = seal(KEY, PASSPHRASE).unwrap();

        assert!(unseal(&edited(&file, |value| value["format"] = "other".into()), PASSPHRASE).is_err());
        assert!(unseal("{}", PASSPHRASE).is_err());
    }

    #[test]
    fn refuses_a_weakened_iteration_count() {
        let file = seal(KEY, PASSPHRASE).unwrap();
        let weakened = edited(&file, |value| value["iterations"] = 1000.into());
        let error = unseal(&weakened, PASSPHRASE).unwrap_err().to_string();

        assert!(error.contains("parameters"), "{error}");
    }

    #[test]
    fn refuses_a_short_passphrase_or_a_value_that_is_no_store_key() {
        assert!(seal(KEY, "short").is_err());
        assert!(seal("not a key", PASSPHRASE).is_err());
    }
}
