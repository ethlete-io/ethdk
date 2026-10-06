#[cfg(test)]
mod bench;
#[cfg(target_os = "linux")]
mod capture_linux;
mod model;
mod pipeline;
mod whisper;

use crate::calls::CallSource;
use crate::error::TimetrackResult;
use crate::state::Db;
use crate::transcript::TranscriptionState;
use std::path::PathBuf;
use std::time::Duration;

const POLL: Duration = Duration::from_secs(1);
const THREADS: i32 = 4;

pub struct Listener {
    pub db: Db,
    pub calls: CallSource,
    pub state: TranscriptionState,
    pub data_dir: PathBuf,
}

impl Listener {
    fn on_call(&self) -> Option<String> {
        if !self.state.is_enabled() || self.calls.is_paused() {
            return None;
        }

        self.calls.on_call()
    }
}

pub fn start(listener: Listener) {
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);

        let Some(app_id) = listener.on_call() else {
            continue;
        };

        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| listen(&listener, app_id)));
        let detail = match outcome {
            Ok(Ok(())) => None,
            Ok(Err(error)) => Some(error.to_string()),
            Err(_) => Some("the listener panicked".to_string()),
        };

        listener.state.update(|status| {
            status.listening = false;
            status.detail = detail;
        });

        // A call that cannot be listened to is not retried every second for as long as it runs.
        while listener.on_call().is_some() {
            std::thread::sleep(POLL);
        }
    });
}

#[cfg(target_os = "linux")]
fn listen(listener: &Listener, app_id: String) -> TimetrackResult<()> {
    use pipeline::{Call, Chunker, Spoken};
    use std::io::Read;

    let model = model::DEFAULT;

    listener.state.update(|status| {
        status.model = Some(model.name.to_string());
        status.detail = Some("loading the model".to_string());
    });

    let path = tauri::async_runtime::block_on(model::ensure(&listener.data_dir, &model))?;
    let language = listener.state.clone();
    let mut whisper = whisper::Whisper::load(&path, model.name, THREADS, move || language.language())?;
    let call = Call {
        app_id,
        started_at_ms: chrono::Utc::now().timestamp_millis(),
    };
    let mut child = capture_linux::spawn()?;
    let Some(mut stdout) = child.stdout.take() else {
        let _ = child.kill();
        return Ok(());
    };
    let (sender, receiver) = std::sync::mpsc::sync_channel::<Spoken>(2);
    let reader = std::thread::spawn(move || {
        let mut chunker = Chunker::default();
        let mut buffer = [0u8; 16 * 1024];
        let send = |audio: Vec<f32>| {
            let spoken_ms = (audio.len() * 1000 / pipeline::SAMPLE_RATE) as i64;

            sender.send(Spoken {
                at_ms: chrono::Utc::now().timestamp_millis() - spoken_ms,
                audio,
            })
        };

        while let Ok(read) = stdout.read(&mut buffer) {
            if read == 0 {
                break;
            }

            for audio in chunker.push_bytes(&buffer[..read]) {
                if send(audio).is_err() {
                    return;
                }
            }
        }

        if let Some(tail) = chunker.finish() {
            let _ = send(tail);
        }
    });

    listener.state.update(|status| {
        status.listening = true;
        status.detail = None;
    });

    let db = listener.db.clone();
    let state = listener.state.clone();

    std::thread::scope(|scope| {
        scope.spawn(|| {
            while listener.on_call().is_some() {
                std::thread::sleep(POLL);
            }

            let _ = child.kill();
            let _ = child.wait();
        });

        pipeline::run(
            receiver,
            &call,
            &mut whisper,
            |chunk| {
                let chunk = chunk.clone();
                tauri::async_runtime::block_on(db.run(move |connection| crate::transcript::append(connection, &chunk)))
            },
            |error| state.update(|status| status.detail = Some(error)),
        );
    });

    let _ = reader.join();

    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn listen(_listener: &Listener, _app_id: String) -> TimetrackResult<()> {
    Err(crate::error::TimetrackError::Rejected(
        "the microphone can only be transcribed on Linux so far".to_string(),
    ))
}
