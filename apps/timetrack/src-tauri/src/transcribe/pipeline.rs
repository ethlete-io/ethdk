use crate::error::TimetrackResult;
use crate::transcript::TranscriptChunk;
use std::sync::mpsc::Receiver;

pub const SAMPLE_RATE: usize = 16_000;
pub const CHUNK_SAMPLES: usize = 30 * SAMPLE_RATE;
const MIN_TAIL_SAMPLES: usize = 2 * SAMPLE_RATE;
const SILENCE_RMS: f32 = 0.002;

pub struct Heard {
    pub text: String,
    pub language: Option<String>,
}

pub trait Transcribe {
    fn model(&self) -> &str;
    fn transcribe(&mut self, audio: &[f32]) -> TimetrackResult<Heard>;
}

/// Cuts a stream of raw little-endian `f32` mono samples into chunks of `CHUNK_SAMPLES`, in memory.
#[derive(Default)]
pub struct Chunker {
    buffer: Vec<f32>,
    carry: Vec<u8>,
}

impl Chunker {
    pub fn push_bytes(&mut self, bytes: &[u8]) -> Vec<Vec<f32>> {
        self.carry.extend_from_slice(bytes);

        let whole = self.carry.len() / 4 * 4;
        let mut full = Vec::new();

        for sample in self.carry[..whole].chunks_exact(4) {
            if self.buffer.capacity() == 0 {
                self.buffer.reserve_exact(CHUNK_SAMPLES);
            }

            self.buffer
                .push(f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]));

            if self.buffer.len() == CHUNK_SAMPLES {
                full.push(std::mem::take(&mut self.buffer));
            }
        }

        self.carry.drain(..whole);

        full
    }

    /// What is left once the stream ended, unless it is too short to say anything.
    pub fn finish(self) -> Option<Vec<f32>> {
        (self.buffer.len() >= MIN_TAIL_SAMPLES).then_some(self.buffer)
    }
}

/// A muted or idle microphone still delivers samples, and whisper invents sentences for silence.
pub fn is_silent(audio: &[f32]) -> bool {
    if audio.is_empty() {
        return true;
    }

    let energy = audio.iter().map(|sample| sample * sample).sum::<f32>() / audio.len() as f32;

    energy.sqrt() < SILENCE_RMS
}

pub struct Call {
    pub app_id: String,
    pub started_at_ms: i64,
}

pub struct Spoken {
    pub at_ms: i64,
    pub audio: Vec<f32>,
}

pub fn transcribe_chunk(
    transcriber: &mut dyn Transcribe,
    call: &Call,
    spoken: Spoken,
) -> TimetrackResult<Option<TranscriptChunk>> {
    let Spoken { at_ms, audio } = spoken;

    if is_silent(&audio) {
        return Ok(None);
    }

    let heard = transcriber.transcribe(&audio)?;

    drop(audio);

    let text = heard.text.trim();

    if text.is_empty() {
        return Ok(None);
    }

    Ok(Some(TranscriptChunk {
        at_ms,
        call_started_at_ms: call.started_at_ms,
        app_id: call.app_id.clone(),
        model: transcriber.model().to_string(),
        language: heard.language,
        text: text.to_string(),
    }))
}

/// Transcribes each chunk as it arrives and stores its text before taking the next, until the sender
/// hangs up. A chunk that fails is dropped with its audio; the error names no transcript text.
pub fn run(
    chunks: Receiver<Spoken>,
    call: &Call,
    transcriber: &mut dyn Transcribe,
    mut store: impl FnMut(&TranscriptChunk) -> TimetrackResult<()>,
    mut failed: impl FnMut(String),
) {
    for spoken in chunks {
        match transcribe_chunk(transcriber, call, spoken).and_then(|chunk| chunk.as_ref().map(&mut store).transpose()) {
            Ok(_) => {}
            Err(error) => failed(error.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::TimetrackError;
    use rusqlite::Connection;

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

    fn bytes(samples: &[f32]) -> Vec<u8> {
        samples.iter().flat_map(|sample| sample.to_le_bytes()).collect()
    }

    #[test]
    fn cuts_the_stream_into_thirty_second_chunks_across_split_samples() {
        let mut chunker = Chunker::default();
        let stream = bytes(&speech(CHUNK_SAMPLES * 2 + SAMPLE_RATE * 3));
        let mut chunks = Vec::new();

        for piece in stream.chunks(4093) {
            chunks.extend(chunker.push_bytes(piece));
        }

        assert_eq!(chunks.len(), 2);
        assert!(chunks.iter().all(|chunk| chunk.len() == CHUNK_SAMPLES));
        assert_eq!(chunker.finish().map(|tail| tail.len()), Some(SAMPLE_RATE * 3));
    }

    #[test]
    fn drops_a_tail_too_short_to_say_anything() {
        let mut chunker = Chunker::default();

        chunker.push_bytes(&bytes(&speech(SAMPLE_RATE)));

        assert!(chunker.finish().is_none());
    }

    #[test]
    fn never_asks_whisper_about_silence() {
        let mut echo = Echo { heard: Vec::new() };
        let silence = Spoken {
            at_ms: 2_000,
            audio: vec![0.0005; CHUNK_SAMPLES],
        };

        assert!(transcribe_chunk(&mut echo, &call(), silence).unwrap().is_none());
        assert!(echo.heard.is_empty());
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
                    })
                    .unwrap();
            }
        });
        let mut echo = Echo { heard: Vec::new() };
        let mut failures = Vec::new();

        run(
            receiver,
            &call(),
            &mut echo,
            |chunk| crate::transcript::append(&connection, chunk),
            |error| failures.push(error),
        );
        producer.join().unwrap();

        assert!(failures.is_empty());
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
        );

        assert_eq!(stored, vec!["zweiter"]);
        assert_eq!(failures.len(), 1);
    }
}
