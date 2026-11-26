use crate::calls::CallSource;
use objc2_core_audio::{
    kAudioHardwarePropertyProcessObjectList, kAudioObjectPropertyElementMain, kAudioObjectPropertyScopeGlobal,
    kAudioObjectSystemObject, kAudioProcessPropertyBundleID, kAudioProcessPropertyIsRunningInput,
    AudioObjectAddPropertyListener, AudioObjectGetPropertyData, AudioObjectGetPropertyDataSize, AudioObjectID,
    AudioObjectPropertyAddress,
};
use objc2_core_foundation::{CFRetained, CFString};
use std::ffi::c_void;
use std::ptr::NonNull;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// A sweep costs 8-12 ms, which at this interval is under 0.02 % of a core.
///
/// It is not how the source learns of a call — the CoreAudio listeners are, and they are why this is a
/// minute rather than a second. It is what makes a callback macOS never delivered cost one late edge
/// rather than a call that never ends.
const BACKSTOP: Duration = Duration::from_secs(60);

/// `kAudioHardwarePropertyProcessObjectList` arrived in macOS 14.4, and it is the whole source.
const NO_PROCESS_LIST: &str =
    "Timetrack cannot see which application is on a call, because this macOS is older than 14.4";

/// Wakes the sweep thread from a CoreAudio callback.
///
/// The callback says a property changed and never which way, so it only signals and the sweep thread
/// re-reads everything. Keeping the read off the callback thread is also what keeps a CoreAudio
/// listener from blocking on this app's own locks.
static NUDGE: OnceLock<Mutex<Sender<()>>> = OnceLock::new();

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn address(selector: u32) -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: selector,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
    }
}

fn processes() -> Option<Vec<AudioObjectID>> {
    let mut addr = address(kAudioHardwarePropertyProcessObjectList);
    let mut size: u32 = 0;

    if unsafe {
        AudioObjectGetPropertyDataSize(
            kAudioObjectSystemObject as u32,
            NonNull::from(&mut addr),
            0,
            std::ptr::null(),
            NonNull::from(&mut size),
        )
    } != 0
    {
        return None;
    }

    let mut ids: Vec<AudioObjectID> = vec![0; size as usize / std::mem::size_of::<AudioObjectID>()];
    let mut io = size;

    if unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject as u32,
            NonNull::from(&mut addr),
            0,
            std::ptr::null(),
            NonNull::from(&mut io),
            NonNull::new(ids.as_mut_ptr().cast::<c_void>())?,
        )
    } != 0
    {
        return None;
    }

    Some(ids)
}

fn is_running_input(object: AudioObjectID) -> bool {
    let mut addr = address(kAudioProcessPropertyIsRunningInput);
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;

    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            NonNull::from(&mut addr),
            0,
            std::ptr::null(),
            NonNull::from(&mut size),
            NonNull::from(&mut value).cast::<c_void>(),
        )
    };

    status == 0 && value == 1
}

/// The bundle id, which is the same identifier `window_macos` reports for a window.
///
/// The helper process that actually holds the microphone reports its own — `com.hnc.Discord`'s is
/// `com.hnc.Discord.helper.Renderer` — and that is a prefix of the window's, which is what lets the
/// read side pair the two without a table of exceptions.
fn bundle_id(object: AudioObjectID) -> Option<String> {
    let mut addr = address(kAudioProcessPropertyBundleID);
    let mut value: *const CFString = std::ptr::null();
    let mut size = std::mem::size_of::<*const CFString>() as u32;

    let status = unsafe {
        AudioObjectGetPropertyData(
            object,
            NonNull::from(&mut addr),
            0,
            std::ptr::null(),
            NonNull::from(&mut size),
            NonNull::from(&mut value).cast::<c_void>(),
        )
    };

    if status != 0 {
        return None;
    }

    Some(unsafe { CFRetained::from_raw(NonNull::new(value.cast_mut())?) }.to_string())
}

/// Which of the read processes count as holding the microphone.
///
/// A process with no bundle id is dropped rather than reported under a placeholder: the identifier is
/// the only thing a rule can match and the only thing that pairs a call to a window, so a call nothing
/// can name is a call nothing can classify, and under default-deny it would count as nothing anyway.
fn holders(read: impl IntoIterator<Item = (bool, Option<String>)>) -> Vec<String> {
    read.into_iter()
        .filter_map(|(running, bundle)| running.then_some(bundle).flatten())
        .filter(|bundle| !bundle.is_empty())
        .collect()
}

fn listen(object: AudioObjectID, selector: u32) -> bool {
    let mut addr = address(selector);

    let status = unsafe {
        AudioObjectAddPropertyListener(object, NonNull::from(&mut addr), Some(changed), std::ptr::null_mut())
    };

    status == 0
}

unsafe extern "C-unwind" fn changed(
    _object: AudioObjectID,
    _count: u32,
    _address: NonNull<AudioObjectPropertyAddress>,
    _data: *mut c_void,
) -> i32 {
    if let Some(nudge) = NUDGE.get().and_then(|nudge| nudge.lock().ok()) {
        let _ = nudge.send(());
    }

    0
}

/// Re-reads who holds the microphone, and starts watching any process that has appeared since.
///
/// The listener has to be added before the state is read, not after: a process that took the
/// microphone between the two reads is then caught by its own callback rather than waited for.
fn sweep(sink: &CallSource, listening: &mut Vec<AudioObjectID>) {
    // A paused Timetrack does not look at the machine at all, and it forgets what it saw: a call that
    // outlives the pause has to be seen to start again, or its end arrives as an edge with no opening.
    if sink.is_paused() {
        sink.forget();

        return;
    }

    let Some(ids) = processes() else {
        sink.set_status("none", Some(NO_PROCESS_LIST.to_string()));

        return;
    };

    for id in &ids {
        if !listening.contains(id) && listen(*id, kAudioProcessPropertyIsRunningInput) {
            listening.push(*id);
        }
    }

    listening.retain(|id| ids.contains(id));

    sink.reconcile(
        now_ms(),
        holders(ids.iter().map(|id| (is_running_input(*id), bundle_id(*id)))),
    );
}

/// Watches which process holds the microphone, on a thread of its own.
///
/// CoreAudio delivers a property listener callback on its own internal thread, so this registers no
/// run loop — measured 2026-09-09: the callbacks arrive with no CFRunLoop running on any thread of
/// this process. A panic is caught for the same reason as in the window source: the status is what the
/// UI tells the user is running, and a dead thread that still reads `macos-core-audio` is worse than
/// no call source.
pub fn start(sink: CallSource) {
    let (sender, receiver) = channel();

    if NUDGE.set(Mutex::new(sender)).is_err() {
        return;
    }

    if processes().is_none() {
        sink.set_status("none", Some(NO_PROCESS_LIST.to_string()));

        return;
    }

    sink.set_status("macos-core-audio", None);
    listen(kAudioObjectSystemObject as u32, kAudioHardwarePropertyProcessObjectList);

    std::thread::spawn(move || {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut listening = Vec::new();

            loop {
                sweep(&sink, &mut listening);

                match receiver.recv_timeout(BACKSTOP) {
                    Ok(()) | Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
        }));

        if outcome.is_err() {
            sink.set_status("none", Some("the call source panicked; see the host log".to_string()));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(pairs: &[(bool, Option<&str>)]) -> Vec<(bool, Option<String>)> {
        pairs
            .iter()
            .map(|(running, bundle)| (*running, bundle.map(str::to_string)))
            .collect()
    }

    #[test]
    fn reports_only_the_processes_holding_the_microphone() {
        let held = holders(read(&[
            (false, Some("com.apple.Music")),
            (true, Some("com.hnc.Discord.helper.Renderer")),
            (false, Some("com.tinyspeck.slackmacgap")),
        ]));

        assert_eq!(held, vec!["com.hnc.Discord.helper.Renderer"]);
    }

    #[test]
    fn drops_a_holder_that_reports_no_bundle_id() {
        assert!(holders(read(&[(true, None)])).is_empty());
        assert!(holders(read(&[(true, Some(""))])).is_empty());
    }

    #[test]
    fn reports_every_holder_when_two_applications_are_on_a_call() {
        let held = holders(read(&[
            (true, Some("com.hnc.Discord.helper.Renderer")),
            (true, Some("com.tinyspeck.slackmacgap")),
        ]));

        assert_eq!(held.len(), 2);
    }
}
