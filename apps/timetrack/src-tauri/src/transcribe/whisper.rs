use super::pipeline::{Heard, Transcribe};
use crate::error::{TimetrackError, TimetrackResult};
use std::path::Path;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState};

fn rejected(error: whisper_rs::WhisperError) -> TimetrackError {
    TimetrackError::Rejected(format!("whisper: {error}"))
}

pub struct Whisper {
    state: WhisperState,
    model: String,
    threads: i32,
    prompt: Option<String>,
}

impl Whisper {
    pub fn load(path: &Path, model: &str, threads: i32) -> TimetrackResult<Self> {
        // whisper.cpp prints to stderr by default; without a log backend these hooks drop every line.
        whisper_rs::install_logging_hooks();

        let path = path
            .to_str()
            .ok_or_else(|| TimetrackError::Rejected("the model path is not valid UTF-8".to_string()))?;
        let context = WhisperContext::new_with_params(path, WhisperContextParameters::default()).map_err(rejected)?;
        let state = context.create_state().map_err(rejected)?;

        Ok(Self {
            state,
            model: model.to_string(),
            threads,
            prompt: None,
        })
    }

    #[cfg(test)]
    pub fn with_prompt(mut self, prompt: Option<String>) -> Self {
        self.prompt = prompt;
        self
    }
}

impl Transcribe for Whisper {
    fn model(&self) -> &str {
        &self.model
    }

    fn transcribe(&mut self, audio: &[f32]) -> TimetrackResult<Heard> {
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        params.set_n_threads(self.threads);
        params.set_language(Some("auto"));
        params.set_no_context(true);
        params.set_suppress_blank(true);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        if let Some(prompt) = &self.prompt {
            params.set_initial_prompt(prompt);
        }

        self.state.full(params, audio).map_err(rejected)?;

        let text = self
            .state
            .as_iter()
            .filter_map(|segment| segment.to_str_lossy().ok().map(|text| text.into_owned()))
            .collect::<String>();
        let language = whisper_rs::get_lang_str(self.state.full_lang_id_from_state()).map(str::to_owned);

        Ok(Heard { text, language })
    }
}
