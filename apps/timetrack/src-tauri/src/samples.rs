use crate::error::{TimetrackError, TimetrackResult};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Samples held before the oldest is dropped. A webview that stopped draining must not be able to grow
/// the host without bound, and `dropped` is what tells the collector the gap was loss, not idleness.
pub const MAX_BUFFERED: usize = 4096;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sample<T> {
    pub seq: u64,
    pub at_ms: i64,
    #[serde(flatten)]
    pub payload: T,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SampleBatch<T> {
    pub events: Vec<Sample<T>>,
    pub next_seq: u64,
    /// Samples dropped since the last drain because the buffer was full.
    pub dropped: u64,
}

struct Inner<T> {
    buffer: Mutex<Buffer<T>>,
    paused: AtomicBool,
}

struct Buffer<T> {
    events: VecDeque<Sample<T>>,
    next_seq: u64,
    dropped: u64,
}

/// What a source has observed and nothing has stored yet.
///
/// A sample is kept until the collector drains past its `seq` rather than until it is read, so a
/// webview that reloaded between reading and storing sees it again. Re-storing an identical sample is
/// harmless; losing one leaves a gap that reads as absence.
pub struct SampleBuffer<T>(Arc<Inner<T>>);

impl<T> Clone for SampleBuffer<T> {
    fn clone(&self) -> Self {
        Self(Arc::clone(&self.0))
    }
}

impl<T: Clone> SampleBuffer<T> {
    pub fn new() -> Self {
        Self(Arc::new(Inner {
            buffer: Mutex::new(Buffer {
                events: VecDeque::new(),
                next_seq: 1,
                dropped: 0,
            }),
            paused: AtomicBool::new(false),
        }))
    }

    /// Stops and starts collection. A source reads this to stop looking at the machine at all; the
    /// buffer enforces it regardless, so a source that forgets to ask still collects nothing.
    pub fn set_paused(&self, paused: bool) {
        self.0.paused.store(paused, Ordering::SeqCst);
    }

    pub fn is_paused(&self) -> bool {
        self.0.paused.load(Ordering::SeqCst)
    }

    pub fn push(&self, at_ms: i64, payload: T) {
        if self.is_paused() {
            return;
        }

        let Ok(mut buffer) = self.0.buffer.lock() else {
            return;
        };

        let seq = buffer.next_seq;

        buffer.next_seq += 1;
        buffer.events.push_back(Sample { seq, at_ms, payload });

        while buffer.events.len() > MAX_BUFFERED {
            buffer.events.pop_front();
            buffer.dropped += 1;
        }
    }

    /// Hands back everything buffered after `after_seq`, and releases everything up to it.
    ///
    /// Pass the sequence the last batch was actually stored under, not the one it ended at:
    /// acknowledging a batch that failed to store would drop it.
    pub fn drain_after(&self, after_seq: u64) -> TimetrackResult<SampleBatch<T>> {
        let mut buffer = self.0.buffer.lock().map_err(|_| TimetrackError::Poisoned)?;

        while buffer.events.front().is_some_and(|event| event.seq <= after_seq) {
            buffer.events.pop_front();
        }

        let dropped = std::mem::take(&mut buffer.dropped);

        Ok(SampleBatch {
            events: buffer.events.iter().cloned().collect(),
            next_seq: buffer.next_seq,
            dropped,
        })
    }
}

impl<T: Clone> Default for SampleBuffer<T> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn buffer() -> SampleBuffer<String> {
        SampleBuffer::new()
    }

    #[test]
    fn drains_in_order_and_numbers_from_one() {
        let samples = buffer();

        samples.push(10, "a".to_string());
        samples.push(20, "b".to_string());

        let batch = samples.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), 2);
        assert_eq!(batch.events[0].seq, 1);
        assert_eq!(batch.events[1].seq, 2);
        assert_eq!(batch.next_seq, 3);
        assert_eq!(batch.dropped, 0);
    }

    #[test]
    fn keeps_unacknowledged_samples_for_the_next_drain() {
        let samples = buffer();

        samples.push(10, "a".to_string());
        samples.push(20, "b".to_string());

        assert_eq!(samples.drain_after(0).unwrap().events.len(), 2);
        assert_eq!(samples.drain_after(0).unwrap().events.len(), 2);

        let batch = samples.drain_after(1).unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].seq, 2);
    }

    #[test]
    fn drops_the_oldest_when_nothing_drains_and_reports_it_once() {
        let samples = buffer();

        for index in 0..(MAX_BUFFERED + 5) {
            samples.push(index as i64, "a".to_string());
        }

        let batch = samples.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), MAX_BUFFERED);
        assert_eq!(batch.dropped, 5);
        assert_eq!(batch.events[0].seq, 6);
        assert_eq!(samples.drain_after(0).unwrap().dropped, 0);
    }

    #[test]
    fn takes_no_sample_at_all_while_collection_is_paused() {
        let samples = buffer();

        samples.set_paused(true);
        samples.push(10, "a".to_string());

        assert!(samples.drain_after(0).unwrap().events.is_empty());
    }

    #[test]
    fn keeps_what_it_collected_before_the_pause() {
        let samples = buffer();

        samples.push(10, "a".to_string());
        samples.set_paused(true);
        samples.push(20, "b".to_string());
        samples.set_paused(false);

        let batch = samples.drain_after(0).unwrap();

        assert_eq!(batch.events.len(), 1);
        assert_eq!(batch.events[0].at_ms, 10);
    }

    #[test]
    fn a_clone_shares_one_buffer() {
        let samples = buffer();
        let other = samples.clone();

        other.push(10, "a".to_string());

        assert_eq!(samples.drain_after(0).unwrap().events.len(), 1);
    }
}
