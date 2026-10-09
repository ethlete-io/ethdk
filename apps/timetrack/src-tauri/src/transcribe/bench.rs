//! Measures a model on a WAV through the same chunk path the listener uses:
//! `TT_MODEL=<path> TT_WAV=<16 kHz mono s16 wav> cargo test --release --features transcribe
//! transcribe::bench -- --ignored --nocapture`. `TT_THREADS`, `TT_PROMPT`, `TT_LANGUAGE` and `TT_NO_GATE=1`
//! (the former fixed 30 s chunks behind an RMS gate) vary it.

use super::pipeline::{Transcribe, SAMPLE_RATE};
use super::segment::Segmenter;
use super::whisper::Whisper;
use std::time::Instant;

fn samples_of(wav: &[u8]) -> Vec<u8> {
    let mut at = 12;

    while at + 8 <= wav.len() {
        let size = u32::from_le_bytes([wav[at + 4], wav[at + 5], wav[at + 6], wav[at + 7]]) as usize;

        if &wav[at..at + 4] == b"data" {
            return wav[at + 8..(at + 8 + size).min(wav.len())]
                .chunks_exact(2)
                .flat_map(|pair| (f32::from(i16::from_le_bytes([pair[0], pair[1]])) / 32768.0).to_le_bytes())
                .collect();
        }

        at += 8 + size + size % 2;
    }

    panic!("no data chunk in the WAV");
}

fn cpu_seconds() -> f64 {
    let mut usage = std::mem::MaybeUninit::<libc::rusage>::zeroed();

    // SAFETY: getrusage only writes into the struct it is given.
    let usage = unsafe {
        libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr());
        usage.assume_init()
    };
    let seconds = |time: libc::timeval| time.tv_sec as f64 + time.tv_usec as f64 / 1e6;

    seconds(usage.ru_utime) + seconds(usage.ru_stime)
}

fn peak_rss_mb() -> f64 {
    std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|status| {
            status
                .lines()
                .find(|line| line.starts_with("VmHWM:"))
                .and_then(|line| line.split_whitespace().nth(1)?.parse::<f64>().ok())
        })
        .map_or(0.0, |kb| kb / 1024.0)
}

#[test]
#[ignore]
fn bench() {
    let model = std::env::var("TT_MODEL").expect("TT_MODEL");
    let wav = std::fs::read(std::env::var("TT_WAV").expect("TT_WAV")).unwrap();
    let threads = std::env::var("TT_THREADS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(4);
    let gate = std::env::var("TT_NO_GATE").is_err();
    let name = std::path::Path::new(&model)
        .file_stem()
        .unwrap()
        .to_string_lossy()
        .into_owned();

    let loading = Instant::now();
    let language: &'static str = std::env::var("TT_LANGUAGE").map_or("auto", |language| language.leak());
    let mut whisper = Whisper::load(std::path::Path::new(&model), &name, threads, move || language)
        .unwrap()
        .with_prompt(std::env::var("TT_PROMPT").ok());
    let loaded_in = loading.elapsed().as_secs_f64();

    let samples = samples_of(&wav);
    let chunks: Vec<(f64, Vec<f32>)> = if gate {
        let mut segmenter = Segmenter::default();
        let mut speech = segmenter.push_bytes(&samples);

        speech.extend(segmenter.finish());
        speech
            .into_iter()
            .map(|speech| (speech.start_sample as f64 / SAMPLE_RATE as f64, speech.audio))
            .collect()
    } else {
        samples
            .chunks(30 * SAMPLE_RATE * 4)
            .enumerate()
            .map(|(index, bytes)| {
                let audio = bytes
                    .chunks_exact(4)
                    .map(|sample| f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]))
                    .collect();

                (index as f64 * 30.0, audio)
            })
            .filter(|(_, audio): &(f64, Vec<f32>)| {
                (audio.iter().map(|sample| sample * sample).sum::<f32>() / audio.len() as f32).sqrt() >= 0.002
            })
            .collect()
    };

    let audio_seconds = samples.len() as f64 / 4.0 / SAMPLE_RATE as f64;
    let (cpu_before, started) = (cpu_seconds(), Instant::now());

    for (index, (start, chunk)) in chunks.iter().enumerate() {
        let at = Instant::now();
        let heard = whisper.transcribe(chunk).unwrap();

        println!(
            "[{index}] at {start:.1}s, {:.1}s audio in {:.2}s, {:?}: {}",
            chunk.len() as f64 / 16_000.0,
            at.elapsed().as_secs_f64(),
            heard.language,
            heard.text.trim()
        );
    }

    let wall = started.elapsed().as_secs_f64();
    let cpu = cpu_seconds() - cpu_before;

    println!(
        "RESULT model={name} threads={threads} gate={gate} chunks={} load={loaded_in:.2}s audio={audio_seconds:.1}s \
         wall={wall:.2}s cpu_s={cpu:.1} \
         rtf={:.3} cpu={:.0}% (of one core) peak_rss={:.0}MB",
        chunks.len(),
        wall / audio_seconds,
        cpu / wall * 100.0,
        peak_rss_mb()
    );
}
