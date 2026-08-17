use crate::window::{WindowEventPayload, WindowSource};
use objc2_app_kit::NSWorkspace;
use objc2_application_services::{AXError, AXUIElement};
use objc2_core_foundation::{CFBoolean, CFDictionary, CFRetained, CFString, CFType};
use objc2_core_graphics::{CGEventSource, CGEventSourceStateID, CGEventType};
use std::ptr::NonNull;
use std::time::Duration;

/// Long enough that reading a diff is not absence, far below `maxUnobservedMs` so a real break still
/// splits the block. The Wayland source registers the same threshold with the compositor.
const IDLE_THRESHOLD_MS: i64 = 5 * 60_000;

/// macOS pushes application activations but never title changes, and a browser tab switch is a context
/// switch, so the window is read on an interval instead.
const POLL: Duration = Duration::from_secs(1);

/// An Accessibility read is IPC into the target application, and an unresponsive one would otherwise
/// hold the sampler thread for as long as it likes.
const AX_TIMEOUT_SECONDS: f32 = 1.0;

const NO_TITLES: &str =
    "Timetrack has no Accessibility permission, so it collects which application was in front but not the window title";

/// `kCGAnyInputEventType`, which the bindings do not carry: it is a header macro, not an enum member.
const ANY_INPUT_EVENT: CGEventType = CGEventType(0xFFFF_FFFF);

const FOCUSED_WINDOW: &str = "AXFocusedWindow";
const TITLE: &str = "AXTitle";

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn attribute(element: &AXUIElement, name: &str) -> Option<CFRetained<CFType>> {
    let key = CFString::from_str(name);
    let mut value: *const CFType = std::ptr::null();

    let error = unsafe { element.copy_attribute_value(&key, NonNull::from(&mut value)) };

    if error != AXError::Success {
        return None;
    }

    Some(unsafe { CFRetained::from_raw(NonNull::new(value.cast_mut())?) })
}

fn focused_window_title(pid: libc::pid_t) -> Option<String> {
    let application = unsafe { AXUIElement::new_application(pid) };

    unsafe { application.set_messaging_timeout(AX_TIMEOUT_SECONDS) };

    let window = attribute(&application, FOCUSED_WINDOW)?.downcast::<AXUIElement>().ok()?;
    let title = attribute(&window, TITLE)?;

    Some(title.downcast_ref::<CFString>()?.to_string())
}

#[derive(Clone, PartialEq)]
struct Sample {
    app_id: String,
    /// Empty without the Accessibility permission, and for a window that has no title of its own.
    title: String,
}

fn frontmost() -> Option<Sample> {
    let application = NSWorkspace::sharedWorkspace().frontmostApplication()?;

    Some(Sample {
        app_id: application
            .bundleIdentifier()
            .or_else(|| application.localizedName())
            .map(|name| name.to_string())
            .unwrap_or_default(),
        title: focused_window_title(application.processIdentifier()).unwrap_or_default(),
    })
}

fn idle_ms() -> i64 {
    let seconds =
        CGEventSource::seconds_since_last_event_type(CGEventSourceStateID::CombinedSessionState, ANY_INPUT_EVENT);

    (seconds * 1000.0) as i64
}

fn trusted() -> bool {
    unsafe { objc2_application_services::AXIsProcessTrusted() }
}

/// Asks for the Accessibility permission, which is what turns window titles on.
///
/// macOS shows the dialog once per binary and then only ever opens Settings, so the answer is the
/// current state rather than the user's decision.
pub fn request_accessibility() -> bool {
    let prompt = unsafe { objc2_application_services::kAXTrustedCheckOptionPrompt };
    let options = CFDictionary::<CFString, CFBoolean>::from_slices(&[prompt], &[CFBoolean::new(true)]);

    unsafe { objc2_application_services::AXIsProcessTrustedWithOptions(Some(options.as_opaque())) }
}

struct Sampler {
    sink: WindowSource,
    emitted: Option<Sample>,
    idle: bool,
    trusted: bool,
}

impl Sampler {
    fn new(sink: WindowSource) -> Self {
        let trusted = trusted();

        sink.set_status(
            if trusted { "macos-ax" } else { "macos-app-only" },
            (!trusted).then(|| NO_TITLES.to_string()),
        );

        Self {
            sink,
            emitted: None,
            idle: false,
            trusted,
        }
    }

    /// Reads nothing at all while collection is paused — not the frontmost window, not the idle
    /// timer. That is what makes the pause a pause rather than a filter: the Accessibility read is
    /// IPC into whatever application is in front, and a paused Timetrack must not be making it.
    ///
    /// The last emitted sample is forgotten on the way out, because a focus sample is only pushed
    /// when it differs from the last one. Without this, resuming in the window the pause started in
    /// would emit nothing until the next context switch, and the block would not restart.
    fn tick(&mut self) {
        if self.sink.is_paused() {
            self.emitted = None;

            return;
        }

        self.apply(now_ms(), idle_ms(), trusted(), frontmost);
    }

    /// The rules, over one set of readings. `frontmost` is only called when somebody is at the machine.
    fn apply(&mut self, now: i64, idle_ms: i64, trusted: bool, frontmost: impl FnOnce() -> Option<Sample>) {
        // Input stopped `idle_ms` ago and the block ended with it — dating either transition now would
        // bill every break its first five minutes, and bill the machine for the poll it took to notice.
        if self.idle != (idle_ms >= IDLE_THRESHOLD_MS) {
            self.idle = !self.idle;
            self.sink.push(
                now - idle_ms,
                if self.idle {
                    WindowEventPayload::IdleStart
                } else {
                    WindowEventPayload::IdleEnd
                },
            );
        }

        if self.trusted != trusted {
            self.trusted = trusted;
            self.sink.set_status(
                if trusted { "macos-ax" } else { "macos-app-only" },
                (!trusted).then(|| NO_TITLES.to_string()),
            );
        }

        // Nobody is at the machine, and the sample taken when they come back re-establishes the context.
        if self.idle {
            return;
        }

        let Some(sample) = frontmost() else {
            return;
        };

        if self.emitted.as_ref() == Some(&sample) {
            return;
        }

        self.emitted = Some(sample.clone());
        self.sink.push(
            now,
            WindowEventPayload::WindowFocus {
                app_id: sample.app_id,
                title: sample.title,
            },
        );
    }
}

/// Watches the frontmost application, its window title and the input idle timer on its own thread.
///
/// Without the Accessibility permission the titles are empty and everything else still works, which is
/// a degraded source rather than a failed one: the status says so and the app keeps collecting.
///
/// A panic in here is caught for the same reason as on Wayland: the status is what the UI tells the
/// user is running, and a dead thread that still reads `macos-ax` is worse than no window source.
pub fn start(sink: WindowSource) {
    std::thread::spawn(move || {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut sampler = Sampler::new(sink.clone());

            loop {
                sampler.tick();
                std::thread::sleep(POLL);
            }
        }));

        if outcome.is_err() {
            sink.set_status("none", Some("the window source panicked; see the host log".to_string()));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window::WindowEvent;

    const MINUTE: i64 = 60_000;

    fn sample(app_id: &str, title: &str) -> Option<Sample> {
        Some(Sample {
            app_id: app_id.to_string(),
            title: title.to_string(),
        })
    }

    fn sampler() -> Sampler {
        Sampler {
            sink: WindowSource::new(crate::lock::WindowLock::new()),
            emitted: None,
            idle: false,
            trusted: true,
        }
    }

    fn pushed(sampler: &Sampler) -> Vec<WindowEvent> {
        sampler.sink.drain_after(0).unwrap().events
    }

    #[test]
    fn dates_the_idle_start_when_input_stopped() {
        let mut sampler = sampler();

        sampler.apply(60 * MINUTE, 7 * MINUTE, true, || None);

        let events = pushed(&sampler);

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].at_ms, 53 * MINUTE);
        assert!(matches!(events[0].payload, WindowEventPayload::IdleStart));
    }

    #[test]
    fn dates_the_idle_end_when_input_returned() {
        let mut sampler = sampler();

        sampler.apply(60 * MINUTE, 7 * MINUTE, true, || None);
        sampler.apply(70 * MINUTE, MINUTE / 2, true, || sample("com.apple.Safari", "Jira"));

        let events = pushed(&sampler);

        assert_eq!(events.len(), 3);
        assert_eq!(events[1].at_ms, 70 * MINUTE - MINUTE / 2);
        assert!(matches!(events[1].payload, WindowEventPayload::IdleEnd));
    }

    #[test]
    fn does_not_look_at_the_window_while_idle() {
        let mut sampler = sampler();
        let mut looked = false;

        sampler.apply(60 * MINUTE, 7 * MINUTE, true, || {
            looked = true;
            None
        });

        assert!(!looked);
    }

    #[test]
    fn emits_a_focus_sample_only_when_it_changes() {
        let mut sampler = sampler();

        sampler.apply(0, 0, true, || sample("com.microsoft.VSCode", "lib.rs - timetrack"));
        sampler.apply(1000, 0, true, || sample("com.microsoft.VSCode", "lib.rs - timetrack"));
        sampler.apply(2000, 0, true, || sample("com.microsoft.VSCode", "window.rs - timetrack"));

        let events = pushed(&sampler);

        assert_eq!(events.len(), 2);
        assert_eq!(events[1].at_ms, 2000);
    }

    #[test]
    fn collects_nothing_while_collection_is_paused() {
        let mut sampler = sampler();

        sampler.sink.set_paused(true);
        sampler.apply(60 * MINUTE, 7 * MINUTE, true, || sample("com.microsoft.VSCode", "lib.rs"));

        assert!(pushed(&sampler).is_empty());
    }

    #[test]
    fn re_establishes_the_window_after_a_resume() {
        let mut sampler = sampler();

        sampler.apply(0, 0, true, || sample("com.microsoft.VSCode", "lib.rs - timetrack"));
        sampler.sink.set_paused(true);
        sampler.tick();
        sampler.sink.set_paused(false);
        sampler.apply(60_000, 0, true, || sample("com.microsoft.VSCode", "lib.rs - timetrack"));

        let events = pushed(&sampler);

        assert_eq!(events.len(), 2);
        assert_eq!(events[1].at_ms, 60_000);
    }

    #[test]
    fn reports_the_permission_arriving_while_it_runs() {
        let mut sampler = Sampler {
            trusted: false,
            ..sampler()
        };

        sampler.apply(0, 0, true, || None);

        assert_eq!(sampler.sink.status().unwrap().kind, "macos-ax");
        assert_eq!(sampler.sink.status().unwrap().detail, None);
    }
}
