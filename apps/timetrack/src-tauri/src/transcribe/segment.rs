use super::pipeline::SAMPLE_RATE;
use std::collections::VecDeque;

pub const FRAME_SAMPLES: usize = 256;
pub const MAX_FRAMES: usize = 30 * SAMPLE_RATE / FRAME_SAMPLES;
const PRE_ROLL_FRAMES: usize = 19;
const TAIL_FRAMES: usize = 25;
const PAUSE_FRAMES: usize = 13;
const MIN_CUT_FRAMES: usize = 10 * SAMPLE_RATE / FRAME_SAMPLES;
pub const OVERLAP_FRAMES: usize = SAMPLE_RATE / FRAME_SAMPLES;
const IDLE_FRAMES: usize = 2 * SAMPLE_RATE / FRAME_SAMPLES;
const MIN_VOICED_FRAMES: usize = 16;
const VOICE_THRESHOLD: f32 = 0.5;

pub trait VoiceActivity {
    fn is_voice(&mut self, frame: &[f32]) -> bool;
}

pub struct Earshot(Box<earshot::Detector>);

impl Default for Earshot {
    fn default() -> Self {
        Self(earshot::Detector::default_boxed())
    }
}

impl VoiceActivity for Earshot {
    fn is_voice(&mut self, frame: &[f32]) -> bool {
        let clamped: Vec<f32> = frame.iter().map(|sample| sample.clamp(-1.0, 1.0)).collect();

        self.0.predict_f32(&clamped) >= VOICE_THRESHOLD
    }
}

pub struct Speech {
    pub audio: Vec<f32>,
    pub start_sample: u64,
    /// Its first second repeats the end of the previous chunk, which had no pause to cut at.
    pub overlaps: bool,
}

#[derive(Clone)]
struct Frame {
    samples: Vec<f32>,
    voiced: bool,
    index: u64,
}

/// Cuts a stream of raw little-endian `f32` mono samples into chunks of speech at the pauses
/// between them, in memory.
pub struct Segmenter<V = Earshot> {
    vad: V,
    carry: Vec<u8>,
    partial: Vec<f32>,
    frames_seen: u64,
    chunk: Vec<Frame>,
    tail: Vec<Frame>,
    gap: VecDeque<Frame>,
    quiet: usize,
    overlaps: bool,
}

impl Default for Segmenter<Earshot> {
    fn default() -> Self {
        Self::new(Earshot::default())
    }
}

impl<V: VoiceActivity> Segmenter<V> {
    pub fn new(vad: V) -> Self {
        Self {
            vad,
            carry: Vec::new(),
            partial: Vec::with_capacity(FRAME_SAMPLES),
            frames_seen: 0,
            chunk: Vec::new(),
            tail: Vec::new(),
            gap: VecDeque::new(),
            quiet: 0,
            overlaps: false,
        }
    }

    pub fn samples_seen(&self) -> u64 {
        self.frames_seen * FRAME_SAMPLES as u64 + self.partial.len() as u64
    }

    pub fn push_bytes(&mut self, bytes: &[u8]) -> Vec<Speech> {
        self.carry.extend_from_slice(bytes);

        let whole = self.carry.len() / 4 * 4;
        let mut spoken = Vec::new();

        for index in (0..whole).step_by(4) {
            let sample = &self.carry[index..index + 4];

            self.partial
                .push(f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]));

            if self.partial.len() == FRAME_SAMPLES {
                let samples = std::mem::replace(&mut self.partial, Vec::with_capacity(FRAME_SAMPLES));

                spoken.extend(self.push_frame(samples));
            }
        }

        self.carry.drain(..whole);

        spoken
    }

    /// What is still buffered once the stream ended, unless it holds too little speech.
    pub fn finish(mut self) -> Option<Speech> {
        self.flush()
    }

    fn flush(&mut self) -> Option<Speech> {
        let mut chunk = std::mem::take(&mut self.chunk);

        chunk.append(&mut self.tail);
        self.emit(chunk)
    }

    fn push_frame(&mut self, samples: Vec<f32>) -> Vec<Speech> {
        let frame = Frame {
            voiced: self.vad.is_voice(&samples),
            samples,
            index: self.frames_seen,
        };

        self.frames_seen += 1;

        if frame.voiced {
            self.quiet = 0;

            self.chunk.append(&mut self.tail);
            self.chunk.extend(self.gap.drain(..));
            self.chunk.push(frame);

            let mut spoken = Vec::new();

            while self.chunk.len() >= MAX_FRAMES {
                spoken.extend(self.cut());
            }

            return spoken;
        }

        self.quiet += 1;

        if !self.chunk.is_empty() && self.tail.len() < TAIL_FRAMES {
            self.tail.push(frame);
        } else {
            if self.gap.len() == PRE_ROLL_FRAMES {
                self.gap.pop_front();
            }

            self.gap.push_back(frame);
        }

        let span = self
            .chunk
            .iter()
            .find(|frame| frame.voiced)
            .map_or(0, |first| (self.frames_seen - first.index) as usize);

        if self.quiet >= IDLE_FRAMES && span >= MAX_FRAMES {
            return self.flush().into_iter().collect();
        }

        Vec::new()
    }

    fn cut(&mut self) -> Option<Speech> {
        let (rest, overlaps) = match self.last_pause() {
            Some(at) => (self.chunk.split_off(at), false),
            None => {
                let mut rest = self.chunk[MAX_FRAMES - OVERLAP_FRAMES..MAX_FRAMES].to_vec();

                rest.extend(self.chunk.split_off(MAX_FRAMES));

                (rest, true)
            }
        };
        let done = std::mem::replace(&mut self.chunk, rest);
        let spoken = self.emit(done);

        if self.chunk.iter().any(|frame| frame.voiced) {
            self.overlaps = overlaps;
        } else {
            self.chunk.clear();
        }

        spoken
    }

    fn last_pause(&self) -> Option<usize> {
        let limit = self.chunk.len().min(MAX_FRAMES);
        let mut end = limit;

        while end > MIN_CUT_FRAMES {
            if self.chunk[end - 1].voiced {
                end -= 1;
                continue;
            }

            let mut start = end;

            while start > MIN_CUT_FRAMES && !self.chunk[start - 1].voiced {
                start -= 1;
            }

            if end - start >= PAUSE_FRAMES {
                return Some((start + end) / 2);
            }

            end = start;
        }

        None
    }

    fn emit(&mut self, frames: Vec<Frame>) -> Option<Speech> {
        let overlaps = std::mem::replace(&mut self.overlaps, false);
        let voiced = frames.iter().filter(|frame| frame.voiced).count();
        let first = frames.iter().find(|frame| frame.voiced)?;

        if voiced < MIN_VOICED_FRAMES {
            return None;
        }

        Some(Speech {
            start_sample: first.index * FRAME_SAMPLES as u64,
            overlaps,
            audio: frames.into_iter().flat_map(|frame| frame.samples).collect(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU;

    const SECOND: usize = SAMPLE_RATE;

    struct Loud;

    impl VoiceActivity for Loud {
        fn is_voice(&mut self, frame: &[f32]) -> bool {
            frame.iter().any(|sample| sample.abs() > 0.1)
        }
    }

    fn quiet(seconds: f32) -> Vec<f32> {
        vec![0.0; (seconds * SECOND as f32) as usize]
    }

    fn loud(seconds: f32) -> Vec<f32> {
        (0..(seconds * SECOND as f32) as usize)
            .map(|index| (index as f32 * 0.05).sin() * 0.3)
            .collect()
    }

    fn noise(seconds: f32, amplitude: f32) -> Vec<f32> {
        let mut state: u32 = 0x9e37_79b9;

        (0..(seconds * SECOND as f32) as usize)
            .map(|_| {
                state ^= state << 13;
                state ^= state >> 17;
                state ^= state << 5;

                (state as f32 / u32::MAX as f32 * 2.0 - 1.0) * amplitude
            })
            .collect()
    }

    fn tone(seconds: f32, hertz: f32) -> Vec<f32> {
        (0..(seconds * SECOND as f32) as usize)
            .map(|index| (index as f32 * hertz * TAU / SECOND as f32).sin() * 0.3)
            .collect()
    }

    fn vowels(seconds: f32) -> Vec<f32> {
        let count = (seconds * SECOND as f32) as usize;
        let rate = SECOND as f32;
        let mut phase = 0.0f32;
        let mut signal: Vec<f32> = (0..count)
            .map(|index| {
                let pitch = 120.0 + 20.0 * (index as f32 / rate * 3.0 * TAU).sin();

                phase += pitch / rate;

                if phase >= 1.0 {
                    phase -= 1.0;
                    1.0
                } else {
                    0.0
                }
            })
            .collect();

        for (formant, bandwidth) in [(700.0f32, 130.0f32), (1220.0, 70.0), (2600.0, 160.0)] {
            let radius = (-std::f32::consts::PI * bandwidth / rate).exp();
            let coefficient = 2.0 * radius * (TAU * formant / rate).cos();
            let (mut last, mut before) = (0.0f32, 0.0f32);

            for sample in signal.iter_mut() {
                let value = *sample + coefficient * last - radius * radius * before;

                before = last;
                last = value;
                *sample = value;
            }

            let peak = signal.iter().fold(0.0f32, |peak, sample| peak.max(sample.abs()));

            signal.iter_mut().for_each(|sample| *sample /= peak);
        }

        signal
            .iter()
            .enumerate()
            .map(|(index, sample)| {
                let envelope = (0.5 - 0.5 * (index as f32 / rate * 4.0 * TAU).cos()).sqrt();

                sample * envelope * 0.3
            })
            .collect()
    }

    fn bytes(samples: &[f32]) -> Vec<u8> {
        samples.iter().flat_map(|sample| sample.to_le_bytes()).collect()
    }

    fn segment<V: VoiceActivity>(mut segmenter: Segmenter<V>, parts: &[Vec<f32>]) -> Vec<Speech> {
        let stream = bytes(&parts.concat());
        let mut spoken = Vec::new();

        for piece in stream.chunks(4093) {
            spoken.extend(segmenter.push_bytes(piece));
        }

        spoken.extend(segmenter.finish());
        spoken
    }

    fn seconds(samples: impl TryInto<u64>) -> f32 {
        samples.try_into().unwrap_or(0) as f32 / SECOND as f32
    }

    #[test]
    fn sends_nothing_to_whisper_for_silence_noise_or_a_tone() {
        for audio in [quiet(60.0), noise(60.0, 0.01), noise(60.0, 0.2), tone(60.0, 1_000.0)] {
            assert!(segment(Segmenter::default(), &[audio]).is_empty());
        }
    }

    #[test]
    fn sends_a_burst_of_speech_without_the_quiet_around_it() {
        let spoken = segment(Segmenter::default(), &[quiet(5.0), vowels(3.0), noise(40.0, 0.01)]);

        assert_eq!(spoken.len(), 1);
        assert!((seconds(spoken[0].start_sample) - 5.0).abs() < 0.3);
        assert!(seconds(spoken[0].audio.len()) < 4.5);
    }

    #[test]
    fn keeps_only_short_silences_between_bursts_and_dates_the_chunk_by_its_first_word() {
        let spoken = segment(
            Segmenter::new(Loud),
            &[quiet(4.0), loud(2.0), quiet(20.0), loud(2.0), quiet(40.0)],
        );

        assert_eq!(spoken.len(), 1);
        assert_eq!(spoken[0].start_sample, 4 * SECOND as u64);
        assert!(seconds(spoken[0].audio.len()) < 5.5);
    }

    #[test]
    fn cuts_long_speech_inside_a_pause_rather_than_at_thirty_seconds() {
        let spoken = segment(Segmenter::new(Loud), &[loud(20.0), quiet(0.3), loud(25.0)]);

        assert_eq!(spoken.len(), 2);
        assert!(spoken.iter().all(|speech| speech.audio.len() <= 30 * SECOND));
        assert!(!spoken[1].overlaps);
        assert!((seconds(spoken[0].audio.len()) - 20.15).abs() < 0.05);
        assert!((seconds(spoken[1].start_sample) - 20.3).abs() < 0.02);
        assert!(spoken[0].audio[spoken[0].audio.len() - 100..]
            .iter()
            .all(|sample| *sample == 0.0));
    }

    #[test]
    fn overlaps_the_next_chunk_by_a_second_when_speech_never_pauses() {
        let audio = loud(45.0);
        let spoken = segment(Segmenter::new(Loud), std::slice::from_ref(&audio));
        let repeat = (MAX_FRAMES - OVERLAP_FRAMES) * FRAME_SAMPLES;

        assert_eq!(spoken.len(), 2);
        assert_eq!(spoken[0].audio.len(), 30 * SECOND);
        assert!(!spoken[0].overlaps);
        assert!(spoken[1].overlaps);
        assert_eq!(spoken[1].start_sample, repeat as u64);
        assert_eq!(spoken[1].audio[..FRAME_SAMPLES], audio[repeat..repeat + FRAME_SAMPLES]);
    }

    #[test]
    fn sends_at_most_one_chunk_per_thirty_seconds_of_sparse_talk() {
        let parts: Vec<Vec<f32>> = (0..20).flat_map(|_| [loud(1.0), quiet(5.0)]).collect();
        let spoken = segment(Segmenter::new(Loud), &parts);

        assert!(spoken.len() <= 4);
        assert_eq!(spoken[0].start_sample, 0);
    }

    #[test]
    fn drops_a_click_too_short_to_be_a_word() {
        assert!(segment(Segmenter::new(Loud), &[quiet(2.0), loud(0.1), quiet(2.0)]).is_empty());
    }
}
