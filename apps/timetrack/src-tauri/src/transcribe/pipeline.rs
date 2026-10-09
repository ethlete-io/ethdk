use super::segment::Speech;
use crate::error::TimetrackResult;
use crate::transcript::TranscriptChunk;
use std::sync::mpsc::Receiver;

pub const SAMPLE_RATE: usize = 16_000;

pub struct Heard {
    pub text: String,
    pub language: Option<String>,
}

pub trait Transcribe {
    fn model(&self) -> &str;
    fn transcribe(&mut self, audio: &[f32]) -> TimetrackResult<Heard>;
}

pub struct Call {
    pub app_id: String,
    pub started_at_ms: i64,
}

pub struct Spoken {
    pub at_ms: i64,
    pub audio: Vec<f32>,
    pub overlaps: bool,
}

impl Spoken {
    pub fn heard(speech: Speech, now_ms: i64, samples_seen: u64) -> Self {
        let ago_ms = samples_seen.saturating_sub(speech.start_sample) * 1000 / SAMPLE_RATE as u64;

        Self {
            at_ms: now_ms - ago_ms as i64,
            audio: speech.audio,
            overlaps: speech.overlaps,
        }
    }
}

const MAX_REPEATED_WORDS: usize = 8;

fn word_key(word: &str) -> String {
    word.chars()
        .filter(|char| char.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

pub fn without_repeated_start(previous: &str, text: &str) -> String {
    let before: Vec<String> = previous.split_whitespace().map(word_key).collect();
    let words: Vec<&str> = text.split_whitespace().collect();
    let keys: Vec<String> = words.iter().map(|word| word_key(word)).collect();
    let longest = MAX_REPEATED_WORDS.min(before.len()).min(words.len());
    let repeated = (1..=longest)
        .rev()
        .find(|&count| before[before.len() - count..] == keys[..count])
        .unwrap_or(0);

    words[repeated..].join(" ")
}

pub fn transcribe_chunk(
    transcriber: &mut dyn Transcribe,
    call: &Call,
    spoken: Spoken,
    previous: Option<&str>,
) -> TimetrackResult<Option<TranscriptChunk>> {
    let Spoken { at_ms, audio, overlaps } = spoken;
    let heard = transcriber.transcribe(&audio)?;

    drop(audio);

    let text = match previous.filter(|_| overlaps) {
        Some(previous) => without_repeated_start(previous, &heard.text),
        None => heard.text.trim().to_string(),
    };

    if text.is_empty() {
        return Ok(None);
    }

    Ok(Some(TranscriptChunk {
        at_ms,
        call_started_at_ms: call.started_at_ms,
        app_id: call.app_id.clone(),
        model: transcriber.model().to_string(),
        language: heard.language,
        text,
    }))
}

pub enum Progress {
    Started,
    Finished { took_ms: i64, stored: bool },
}

/// Transcribes each chunk as it arrives and stores its text before taking the next, until the sender
/// hangs up. A chunk that fails is dropped with its audio; the error names no transcript text.
pub fn run(
    chunks: Receiver<Spoken>,
    call: &Call,
    transcriber: &mut dyn Transcribe,
    mut store: impl FnMut(&TranscriptChunk) -> TimetrackResult<()>,
    mut failed: impl FnMut(String),
    mut progress: impl FnMut(Progress),
) {
    let mut previous: Option<String> = None;

    for spoken in chunks {
        progress(Progress::Started);

        let started = std::time::Instant::now();
        let outcome = transcribe_chunk(transcriber, call, spoken, previous.as_deref())
            .and_then(|chunk| chunk.map(|chunk| store(&chunk).map(|()| chunk)).transpose());

        previous = outcome
            .as_ref()
            .ok()
            .and_then(Option::as_ref)
            .map(|chunk| chunk.text.clone());

        progress(Progress::Finished {
            took_ms: started.elapsed().as_millis() as i64,
            stored: matches!(outcome, Ok(Some(_))),
        });

        if let Err(error) = outcome {
            failed(error.to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::TimetrackError;
    use rusqlite::Connection;

    const CHUNK_SAMPLES: usize = 30 * SAMPLE_RATE;

    struct Echo {
        heard: Vec<usize>,
    }

    impl Transcribe for Echo {
        fn model(&self) -> &str {
            "echo"
        }

        fn transcribe(&mut self, audio: &[f32]) -> TimetrackResult<Heard> {
            self.heard.push(audio.len());

            Ok(Heard {
                text: format!(" chunk {} ", self.heard.len()),
                language: Some("de".to_string()),
            })
        }
    }

    fn call() -> Call {
        Call {
            app_id: "google-chrome".to_string(),
            started_at_ms: 1_000,
        }
    }

    fn speech(samples: usize) -> Vec<f32> {
        (0..samples).map(|index| (index as f32 * 0.05).sin() * 0.3).collect()
    }

    #[test]
    fn dates_speech_by_its_first_voiced_frame_not_by_when_it_arrived() {
        let speech = Speech {
            audio: speech(SAMPLE_RATE * 3),
            start_sample: 40 * SAMPLE_RATE as u64,
            overlaps: false,
        };

        assert_eq!(Spoken::heard(speech, 100_000, 45 * SAMPLE_RATE as u64).at_ms, 95_000);
    }

    #[test]
    fn drops_the_words_an_overlapping_chunk_repeats() {
        assert_eq!(
            without_repeated_start("wir schauen uns das Ticket an,", "Ticket an und dann das Review."),
            "und dann das Review."
        );
        assert_eq!(
            without_repeated_start("wir schauen uns das an", "morgen geht es weiter"),
            "morgen geht es weiter"
        );
    }

    #[test]
    fn strips_the_repeat_only_from_a_chunk_that_overlaps_the_one_before() {
        struct Script(Vec<&'static str>);

        impl Transcribe for Script {
            fn model(&self) -> &str {
                "script"
            }

            fn transcribe(&mut self, _audio: &[f32]) -> TimetrackResult<Heard> {
                Ok(Heard {
                    text: self.0.remove(0).to_string(),
                    language: None,
                })
            }
        }

        let (sender, receiver) = std::sync::mpsc::sync_channel(3);

        for (at_ms, overlaps) in [(2_000, false), (32_000, true), (70_000, false)] {
            sender
                .send(Spoken {
                    at_ms,
                    audio: speech(SAMPLE_RATE),
                    overlaps,
                })
                .unwrap();
        }
        drop(sender);

        let mut stored = Vec::new();

        run(
            receiver,
            &call(),
            &mut Script(vec![
                "das Ticket für die Kalenderansicht",
                "Kalenderansicht ist fertig",
                "fertig ist das Review",
            ]),
            |chunk| {
                stored.push(chunk.text.clone());
                Ok(())
            },
            |_| {},
            |_| {},
        );

        assert_eq!(
            stored,
            vec![
                "das Ticket für die Kalenderansicht",
                "ist fertig",
                "fertig ist das Review"
            ]
        );
    }

    #[test]
    fn stores_each_chunk_as_text_in_the_encrypted_store_and_nothing_else_on_disk() {
        let dir = std::env::temp_dir().join(format!("timetrack-pipeline-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();

        let connection: Connection = crate::db::open(&dir.join("timetrack.db"), &"a".repeat(64)).unwrap();
        let (sender, receiver) = std::sync::mpsc::sync_channel(2);
        let producer = std::thread::spawn(move || {
            for at_ms in [2_000, 32_000] {
                sender
                    .send(Spoken {
                        at_ms,
                        audio: speech(CHUNK_SAMPLES),
                        overlaps: false,
                    })
                    .unwrap();
            }
        });
        let mut echo = Echo { heard: Vec::new() };
        let mut failures = Vec::new();
        let mut events = Vec::new();

        run(
            receiver,
            &call(),
            &mut echo,
            |chunk| crate::transcript::append(&connection, chunk),
            |error| failures.push(error),
            |progress| events.push(progress),
        );
        producer.join().unwrap();

        assert!(failures.is_empty());
        assert_eq!(events.len(), 4);
        assert!(matches!(events[1], Progress::Finished { stored: true, .. }));
        assert_eq!(echo.heard, vec![CHUNK_SAMPLES, CHUNK_SAMPLES]);

        let stored: Vec<(String, String)> = connection
            .prepare("SELECT typeof(text), text FROM transcript_chunk ORDER BY at_ms")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(
            stored,
            vec![
                ("text".to_string(), "chunk 1".to_string()),
                ("text".to_string(), "chunk 2".to_string())
            ]
        );

        let mut files: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();

        files.sort();

        assert_eq!(files, vec!["timetrack.db", "timetrack.db-shm", "timetrack.db-wal"]);
    }

    #[test]
    fn keeps_going_after_a_chunk_that_failed() {
        struct Flaky(usize);

        impl Transcribe for Flaky {
            fn model(&self) -> &str {
                "flaky"
            }

            fn transcribe(&mut self, _audio: &[f32]) -> TimetrackResult<Heard> {
                self.0 += 1;

                if self.0 == 1 {
                    return Err(TimetrackError::Rejected("whisper failed".to_string()));
                }

                Ok(Heard {
                    text: "zweiter".to_string(),
                    language: None,
                })
            }
        }

        let (sender, receiver) = std::sync::mpsc::sync_channel(2);

        for at_ms in [2_000, 32_000] {
            sender
                .send(Spoken {
                    at_ms,
                    audio: speech(SAMPLE_RATE * 3),
                    overlaps: false,
                })
                .unwrap();
        }
        drop(sender);

        let mut stored = Vec::new();
        let mut failures = Vec::new();

        run(
            receiver,
            &call(),
            &mut Flaky(0),
            |chunk| {
                stored.push(chunk.text.clone());
                Ok(())
            },
            |error| failures.push(error),
            |_| {},
        );

        assert_eq!(stored, vec!["zweiter"]);
        assert_eq!(failures.len(), 1);
    }
}
