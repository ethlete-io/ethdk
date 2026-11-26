use crate::error::TimetrackResult;
use crate::state::Db;
#[cfg(any(test, feature = "transcribe"))]
use chrono::{Local, TimeZone};
use rusqlite::params;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;

pub const MAX_AGE_MS: i64 = 7 * 24 * 60 * 60 * 1000;

/// One transcribed stretch of the user's own microphone. Text only: there is no field for audio.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptChunk {
    pub at_ms: i64,
    pub call_started_at_ms: i64,
    pub app_id: String,
    pub model: String,
    pub language: Option<String>,
    pub text: String,
}

#[cfg(any(test, feature = "transcribe"))]
fn local_day(at_ms: i64) -> String {
    Local
        .timestamp_millis_opt(at_ms)
        .single()
        .map(|at| at.format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

#[cfg(any(test, feature = "transcribe"))]
pub fn append(connection: &Connection, chunk: &TranscriptChunk) -> TimetrackResult<()> {
    connection.execute(
        "INSERT INTO transcript_chunk (day, at_ms, call_started_at_ms, app_id, model, language, text)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            local_day(chunk.at_ms),
            chunk.at_ms,
            chunk.call_started_at_ms,
            chunk.app_id,
            chunk.model,
            chunk.language,
            chunk.text,
        ],
    )?;

    Ok(())
}

pub fn chunks_for_day(connection: &Connection, day: &str) -> TimetrackResult<Vec<TranscriptChunk>> {
    let mut statement = connection.prepare(
        "SELECT at_ms, call_started_at_ms, app_id, model, language, text FROM transcript_chunk
         WHERE day = ?1 ORDER BY at_ms ASC, id ASC",
    )?;
    let rows = statement.query_map(params![day], |row| {
        Ok(TranscriptChunk {
            at_ms: row.get(0)?,
            call_started_at_ms: row.get(1)?,
            app_id: row.get(2)?,
            model: row.get(3)?,
            language: row.get(4)?,
            text: row.get(5)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn delete_where(connection: &Connection, condition: &str, value: &dyn rusqlite::ToSql) -> TimetrackResult<usize> {
    connection.pragma_update(None, "secure_delete", true)?;

    let deleted = connection.execute(&format!("DELETE FROM transcript_chunk WHERE {condition}"), [value]);

    connection.pragma_update(None, "secure_delete", false)?;

    Ok(deleted?)
}

pub fn delete_day(connection: &Connection, day: &str) -> TimetrackResult<usize> {
    delete_where(connection, "day = ?1", &day)
}

pub fn delete_older_than(connection: &Connection, cutoff_ms: i64) -> TimetrackResult<usize> {
    delete_where(connection, "at_ms < ?1", &cutoff_ms)
}

pub fn prune(connection: &Connection, now_ms: i64) -> TimetrackResult<usize> {
    delete_older_than(connection, now_ms - MAX_AGE_MS)
}

/// Whether the user turned transcription on, and what the listener is doing. It never holds text.
#[derive(Clone, Default)]
pub struct TranscriptionState {
    enabled: Arc<AtomicBool>,
    language: Arc<Mutex<Option<&'static str>>>,
    status: Arc<Mutex<TranscriptionStatus>>,
}

const LANGUAGES: [&str; 101] = [
    "auto", "de", "en", "fr", "es", "it", "nl", "pl", "pt", "tr", "uk", "ru", "ja", "zh", "af", "am", "ar", "as", "az",
    "ba", "be", "bg", "bn", "bo", "br", "bs", "ca", "cs", "cy", "da", "el", "et", "eu", "fa", "fi", "fo", "gl", "gu",
    "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy", "id", "is", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb", "ln",
    "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nn", "no", "oc", "pa", "ps", "ro",
    "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw", "ta", "te", "tg", "th", "tk", "tl", "tt",
    "ur", "uz", "vi", "yi", "yo", "yue",
];
const DEFAULT_LANGUAGE: &str = "de";

/// What the settings document says about transcription, read the way the webview's parser reads it.
#[derive(Debug, PartialEq)]
pub struct TranscriptionSettings {
    pub enabled: bool,
    pub language: &'static str,
}

impl TranscriptionSettings {
    pub fn read(document: &serde_json::Value) -> Self {
        Self {
            enabled: document
                .get("transcribeCalls")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false),
            language: document
                .get("transcribeLanguage")
                .and_then(serde_json::Value::as_str)
                .and_then(|language| LANGUAGES.into_iter().find(|known| *known == language))
                .unwrap_or(DEFAULT_LANGUAGE),
        }
    }
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionStatus {
    /// `false` in a build without the `transcribe` feature, where the setting does nothing.
    pub available: bool,
    pub enabled: bool,
    pub listening: bool,
    pub transcribing: bool,
    pub model: Option<String>,
    /// What the listener is doing before it hears anything, such as loading the model.
    pub detail: Option<String>,
    /// The last failure, kept until the next call is listened to.
    pub error: Option<String>,
    pub last_transcribed_at_ms: Option<i64>,
    /// How long the engine took for the last chunk it turned into text.
    pub last_duration_ms: Option<i64>,
    /// Chunks stored since the app started.
    pub chunks_stored: u32,
}

impl TranscriptionState {
    pub fn apply(&self, settings: &TranscriptionSettings) {
        self.enabled.store(settings.enabled, Ordering::SeqCst);

        if let Ok(mut language) = self.language.lock() {
            *language = Some(settings.language);
        }
    }

    /// The language whisper is told to hear, or `auto` to let it guess for each chunk.
    #[cfg(feature = "transcribe")]
    pub fn language(&self) -> &'static str {
        self.language
            .lock()
            .ok()
            .and_then(|language| *language)
            .unwrap_or(DEFAULT_LANGUAGE)
    }

    #[cfg(feature = "transcribe")]
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    #[cfg(feature = "transcribe")]
    pub fn update(&self, change: impl FnOnce(&mut TranscriptionStatus)) {
        if let Ok(mut status) = self.status.lock() {
            change(&mut status);
        }
    }

    fn status(&self) -> TranscriptionStatus {
        let mut status = self.status.lock().map(|status| status.clone()).unwrap_or_default();

        status.available = cfg!(feature = "transcribe");
        status.enabled = self.enabled.load(Ordering::SeqCst);

        status
    }
}

#[tauri::command]
pub async fn transcription_status(state: State<'_, TranscriptionState>) -> TimetrackResult<TranscriptionStatus> {
    Ok(state.status())
}

/// Every transcript chunk of one local calendar day (`YYYY-MM-DD`), oldest first.
#[tauri::command]
pub async fn transcript_day(db: State<'_, Db>, day: String) -> TimetrackResult<Vec<TranscriptChunk>> {
    db.run(move |connection| chunks_for_day(connection, &day)).await
}

/// Deletes every transcript chunk of one local calendar day (`YYYY-MM-DD`) and says how many went.
#[tauri::command]
pub async fn transcript_delete_day(db: State<'_, Db>, day: String) -> TimetrackResult<usize> {
    db.run(move |connection| delete_day(connection, &day)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: &str = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

    fn store_path(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("timetrack-transcript-{name}-{}", std::process::id()));

        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        dir.join("timetrack.db")
    }

    fn at(day: &str, hour: u32) -> i64 {
        let date = chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d").unwrap();

        Local
            .from_local_datetime(&date.and_hms_opt(hour, 0, 0).unwrap())
            .single()
            .unwrap()
            .timestamp_millis()
    }

    fn chunk(at_ms: i64, text: &str) -> TranscriptChunk {
        TranscriptChunk {
            at_ms,
            call_started_at_ms: at_ms - 30_000,
            app_id: "google-chrome".to_string(),
            model: "small".to_string(),
            language: Some("de".to_string()),
            text: text.to_string(),
        }
    }

    fn migrated() -> Connection {
        let connection = Connection::open_in_memory().unwrap();

        crate::db::migrate(&connection).unwrap();

        connection
    }

    #[test]
    fn reads_back_the_chunks_of_a_day_in_the_order_they_were_said() {
        let connection = migrated();

        append(&connection, &chunk(at("2026-09-30", 11), "danach der Gaming Cluster")).unwrap();
        append(&connection, &chunk(at("2026-09-30", 10), "Update zur Creator Suite")).unwrap();

        let texts: Vec<String> = chunks_for_day(&connection, "2026-09-30")
            .unwrap()
            .into_iter()
            .map(|chunk| chunk.text)
            .collect();

        assert_eq!(texts, vec!["Update zur Creator Suite", "danach der Gaming Cluster"]);
    }

    #[test]
    fn keeps_a_chunk_across_a_reopen_of_the_encrypted_store() {
        let path = store_path("reopen");
        let written = chunk(at("2026-09-30", 10), "Bracket Vorhersagen fehlen noch");

        append(&crate::db::open(&path, KEY).unwrap(), &written).unwrap();

        let reopened = crate::db::open(&path, KEY).unwrap();

        assert_eq!(chunks_for_day(&reopened, "2026-09-30").unwrap(), vec![written]);
    }

    #[test]
    fn writes_no_transcript_text_to_disk_in_the_clear() {
        let path = store_path("at-rest");
        let connection = crate::db::open(&path, KEY).unwrap();

        append(
            &connection,
            &chunk(at("2026-09-30", 10), "PLAINTEXT-CANARY-Creator-Suite"),
        )
        .unwrap();

        let dir = path.parent().unwrap();

        for entry in std::fs::read_dir(dir).unwrap() {
            let bytes = std::fs::read(entry.unwrap().path()).unwrap();

            assert!(!bytes.windows(15).any(|window| window == b"PLAINTEXT-CANAR"));
        }
    }

    #[test]
    fn refuses_to_open_the_transcripts_with_another_key() {
        let path = store_path("wrong-key");

        append(&crate::db::open(&path, KEY).unwrap(), &chunk(at("2026-09-30", 10), "x")).unwrap();

        assert!(crate::db::open(&path, &"f".repeat(64)).is_err());
    }

    #[test]
    fn deletes_one_day_and_leaves_the_others() {
        let connection = migrated();

        append(&connection, &chunk(at("2026-09-29", 10), "gestern")).unwrap();
        append(&connection, &chunk(at("2026-09-30", 10), "heute")).unwrap();
        append(&connection, &chunk(at("2026-09-30", 15), "heute nachmittag")).unwrap();

        assert_eq!(delete_day(&connection, "2026-09-30").unwrap(), 2);
        assert!(chunks_for_day(&connection, "2026-09-30").unwrap().is_empty());
        assert_eq!(chunks_for_day(&connection, "2026-09-29").unwrap().len(), 1);
    }

    #[test]
    fn prunes_what_is_older_than_the_maximum_age() {
        let connection = migrated();
        let now = at("2026-09-30", 12);

        append(&connection, &chunk(now - MAX_AGE_MS - 1, "zu alt")).unwrap();
        append(&connection, &chunk(now - MAX_AGE_MS + 60_000, "gerade noch")).unwrap();

        assert_eq!(prune(&connection, now).unwrap(), 1);

        let left: i64 = connection
            .query_row("SELECT count(*) FROM transcript_chunk", [], |row| row.get(0))
            .unwrap();

        assert_eq!(left, 1);
    }

    #[test]
    fn has_no_column_that_could_hold_audio() {
        let connection = migrated();
        let mut statement = connection
            .prepare("SELECT type FROM pragma_table_info('transcript_chunk')")
            .unwrap();
        let types: Vec<String> = statement
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert!(!types.is_empty());
        assert!(types.iter().all(|kind| kind == "INTEGER" || kind == "TEXT"));
    }

    #[test]
    fn is_off_unless_the_settings_turn_it_on() {
        let enabled = |document| TranscriptionSettings::read(&document).enabled;

        assert!(!enabled(serde_json::json!({})));
        assert!(!enabled(serde_json::json!({ "transcribeCalls": "yes" })));
        assert!(enabled(serde_json::json!({ "transcribeCalls": true })));
    }

    #[test]
    fn hears_german_unless_the_settings_name_another_known_language() {
        let language = |document| TranscriptionSettings::read(&document).language;

        assert_eq!(language(serde_json::json!({})), "de");
        assert_eq!(language(serde_json::json!({ "transcribeLanguage": "Deutsch" })), "de");
        assert_eq!(language(serde_json::json!({ "transcribeLanguage": "sv" })), "sv");
        assert_eq!(language(serde_json::json!({ "transcribeLanguage": "en" })), "en");
        assert_eq!(language(serde_json::json!({ "transcribeLanguage": "auto" })), "auto");
    }

    #[test]
    fn knows_the_languages_the_settings_select_offers() {
        let model = include_str!("../../../../libs/timetrack/src/lib/settings/transcription.ts");
        assert!(LANGUAGES
            .iter()
            .all(|code| model.contains(&format!("'{code}'")) || *code == "auto"));
    }
}
