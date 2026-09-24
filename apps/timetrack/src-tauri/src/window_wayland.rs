use crate::window::{WindowEventPayload, WindowSource};
use std::collections::HashMap;
use wayland_client::backend::ObjectId;
use wayland_client::protocol::{wl_registry, wl_seat};
use wayland_client::{event_created_child, Connection, Dispatch, Proxy, QueueHandle};
use wayland_protocols::ext::idle_notify::v1::client::{ext_idle_notification_v1, ext_idle_notifier_v1};
use wayland_protocols_wlr::foreign_toplevel::v1::client::{
    zwlr_foreign_toplevel_handle_v1, zwlr_foreign_toplevel_manager_v1,
};

/// Long enough that reading a diff is not absence, far below `maxUnobservedMs` so a real break still
/// splits the block.
const IDLE_THRESHOLD_MS: u32 = 5 * 60_000;

/// Short enough that a prompt typed at the desk has input beside it, long enough that it is not a
/// keystroke log.
const INPUT_IDLE_THRESHOLD_MS: u32 = 60_000;

const NO_MANAGER: &str =
    "this compositor does not implement zwlr_foreign_toplevel_manager_v1, so no window titles are collected";

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[derive(Default, Clone)]
struct Toplevel {
    app_id: String,
    title: String,
    activated: bool,
}

struct WaylandState {
    sink: WindowSource,
    manager: Option<zwlr_foreign_toplevel_manager_v1::ZwlrForeignToplevelManagerV1>,
    notifier: Option<ext_idle_notifier_v1::ExtIdleNotifierV1>,
    notification: Option<ext_idle_notification_v1::ExtIdleNotificationV1>,
    input_notification: Option<ext_idle_notification_v1::ExtIdleNotificationV1>,
    seat: Option<wl_seat::WlSeat>,
    /// Properties arrive one event at a time and only count once `done` closes the batch.
    pending: HashMap<ObjectId, Toplevel>,
    emitted: Option<(ObjectId, String, String)>,
}

impl WaylandState {
    /// Emits when the activated window changes, and when the activated window's own title changes —
    /// a browser tab switch is a context switch, and the title is all this protocol says about it.
    ///
    /// The compositor pushes at us rather than being polled, so a pause here can only refuse what
    /// arrives; it cannot stop it being sent, which is the one thing the macOS source can do. What it
    /// can do is forget what it last emitted, so the first event after a resume re-establishes the
    /// window instead of comparing equal to the one the pause started in.
    fn commit(&mut self, id: ObjectId) {
        if self.sink.is_paused() {
            self.emitted = None;

            return;
        }

        let Some(toplevel) = self.pending.get(&id).cloned() else {
            return;
        };

        if !toplevel.activated {
            return;
        }

        let current = (id, toplevel.app_id.clone(), toplevel.title.clone());

        if self.emitted.as_ref() == Some(&current) {
            return;
        }

        self.emitted = Some(current);
        self.sink.push(
            now_ms(),
            WindowEventPayload::WindowFocus {
                app_id: toplevel.app_id,
                title: toplevel.title,
            },
        );
    }

    fn close(&mut self, id: ObjectId) {
        self.pending.remove(&id);

        if self.emitted.as_ref().is_some_and(|(emitted, _, _)| emitted == &id) {
            self.emitted = None;
        }
    }
}

impl Dispatch<wl_registry::WlRegistry, ()> for WaylandState {
    fn event(
        state: &mut Self,
        registry: &wl_registry::WlRegistry,
        event: wl_registry::Event,
        _: &(),
        _: &Connection,
        qh: &QueueHandle<Self>,
    ) {
        let wl_registry::Event::Global {
            name,
            interface,
            version,
        } = event
        else {
            return;
        };

        match interface.as_str() {
            "zwlr_foreign_toplevel_manager_v1" if state.manager.is_none() => {
                state.manager = Some(registry.bind(name, version.min(3), qh, ()));
            }
            "ext_idle_notifier_v1" if state.notifier.is_none() => {
                state.notifier = Some(registry.bind(name, version.min(2), qh, ()));
            }
            "wl_seat" if state.seat.is_none() => {
                state.seat = Some(registry.bind(name, version.min(7), qh, ()));
            }
            _ => {}
        }
    }
}

impl Dispatch<zwlr_foreign_toplevel_manager_v1::ZwlrForeignToplevelManagerV1, ()> for WaylandState {
    fn event(
        _: &mut Self,
        _: &zwlr_foreign_toplevel_manager_v1::ZwlrForeignToplevelManagerV1,
        _: zwlr_foreign_toplevel_manager_v1::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
    }

    event_created_child!(WaylandState, zwlr_foreign_toplevel_manager_v1::ZwlrForeignToplevelManagerV1, [
        zwlr_foreign_toplevel_manager_v1::EVT_TOPLEVEL_OPCODE => (zwlr_foreign_toplevel_handle_v1::ZwlrForeignToplevelHandleV1, ()),
    ]);
}

impl Dispatch<zwlr_foreign_toplevel_handle_v1::ZwlrForeignToplevelHandleV1, ()> for WaylandState {
    fn event(
        state: &mut Self,
        handle: &zwlr_foreign_toplevel_handle_v1::ZwlrForeignToplevelHandleV1,
        event: zwlr_foreign_toplevel_handle_v1::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        let id = handle.id();

        match event {
            zwlr_foreign_toplevel_handle_v1::Event::AppId { app_id } => {
                state.pending.entry(id).or_default().app_id = app_id;
            }
            zwlr_foreign_toplevel_handle_v1::Event::Title { title } => {
                state.pending.entry(id).or_default().title = title;
            }
            zwlr_foreign_toplevel_handle_v1::Event::State { state: states } => {
                let activated = states.as_chunks::<4>().0.iter().any(|chunk| {
                    u32::from_ne_bytes(*chunk) == zwlr_foreign_toplevel_handle_v1::State::Activated as u32
                });

                state.pending.entry(id).or_default().activated = activated;
            }
            zwlr_foreign_toplevel_handle_v1::Event::Done => state.commit(id),
            zwlr_foreign_toplevel_handle_v1::Event::Closed => state.close(id),
            _ => {}
        }
    }
}

#[derive(Clone, Copy)]
enum Threshold {
    Away,
    Input,
}

/// The notification fires a threshold *after* input stopped, and input stopped then — dating it now
/// would bill every break its first five minutes and every desk prompt its last minute.
fn transition(
    threshold: Threshold,
    event: ext_idle_notification_v1::Event,
    now: i64,
) -> Option<(i64, WindowEventPayload)> {
    let (after_ms, idled, resumed) = match threshold {
        Threshold::Away => (
            IDLE_THRESHOLD_MS,
            WindowEventPayload::IdleStart,
            WindowEventPayload::IdleEnd,
        ),
        Threshold::Input => (
            INPUT_IDLE_THRESHOLD_MS,
            WindowEventPayload::InputIdle,
            WindowEventPayload::InputActive,
        ),
    };

    match event {
        ext_idle_notification_v1::Event::Idled => Some((now - i64::from(after_ms), idled)),
        ext_idle_notification_v1::Event::Resumed => Some((now, resumed)),
        _ => None,
    }
}

impl Dispatch<ext_idle_notification_v1::ExtIdleNotificationV1, Threshold> for WaylandState {
    fn event(
        state: &mut Self,
        _: &ext_idle_notification_v1::ExtIdleNotificationV1,
        event: ext_idle_notification_v1::Event,
        threshold: &Threshold,
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
        if let Some((at_ms, payload)) = transition(*threshold, event, now_ms()) {
            state.sink.push(at_ms, payload);
        }
    }
}

impl Dispatch<ext_idle_notifier_v1::ExtIdleNotifierV1, ()> for WaylandState {
    fn event(
        _: &mut Self,
        _: &ext_idle_notifier_v1::ExtIdleNotifierV1,
        _: ext_idle_notifier_v1::Event,
        _: &(),
        _: &Connection,
        _: &QueueHandle<Self>,
    ) {
    }
}

impl Dispatch<wl_seat::WlSeat, ()> for WaylandState {
    fn event(_: &mut Self, _: &wl_seat::WlSeat, _: wl_seat::Event, _: &(), _: &Connection, _: &QueueHandle<Self>) {}
}

fn run(sink: WindowSource) -> Result<(), String> {
    let connection = Connection::connect_to_env().map_err(|error| error.to_string())?;
    let mut queue = connection.new_event_queue();
    let qh = queue.handle();

    connection.display().get_registry(&qh, ());

    let mut state = WaylandState {
        sink,
        manager: None,
        notifier: None,
        notification: None,
        input_notification: None,
        seat: None,
        pending: HashMap::new(),
        emitted: None,
    };

    queue.roundtrip(&mut state).map_err(|error| error.to_string())?;

    if state.manager.is_none() {
        return Err(NO_MANAGER.to_string());
    }

    state.sink.set_status("wayland-wlr", None);

    if let (Some(notifier), Some(seat)) = (state.notifier.clone(), state.seat.clone()) {
        // Version 1 reports the *session* as idle, which any idle inhibitor silences - a video, a
        // call, a download. None of those is somebody at the keyboard, so on a machine that holds one
        // all day the app collects no idle transition at all. Version 2 reports input idleness, which
        // an inhibitor cannot suppress, and that is the only one of the two this app can act on.
        state.notification = Some(if notifier.version() >= 2 {
            notifier.get_input_idle_notification(IDLE_THRESHOLD_MS, &seat, &qh, Threshold::Away)
        } else {
            notifier.get_idle_notification(IDLE_THRESHOLD_MS, &seat, &qh, Threshold::Away)
        });

        // Version 1 would report an inhibitor as input, and a video would read as a desk prompt.
        if notifier.version() >= 2 {
            state.input_notification =
                Some(notifier.get_input_idle_notification(INPUT_IDLE_THRESHOLD_MS, &seat, &qh, Threshold::Input));
        }
    }

    loop {
        queue.blocking_dispatch(&mut state).map_err(|error| error.to_string())?;
    }
}

/// Watches the compositor for focus changes and idleness on its own thread.
///
/// A compositor that implements neither protocol is a documented gap rather than a failure: the app
/// still reconstructs a day from git, the agent logs and the APIs, and the status says what is missing.
///
/// A panic in here is caught for the same reason: the status is what the UI tells the user is running,
/// and a dead thread that still reads `wayland-wlr` is worse than no window source at all.
pub fn start(sink: WindowSource) {
    std::thread::spawn(move || {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| run(sink.clone())));

        let detail = match outcome {
            Ok(Ok(())) => "the window source stopped".to_string(),
            Ok(Err(error)) => error,
            Err(_) => "the window source panicked; see the host log".to_string(),
        };

        sink.set_status("none", Some(detail));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 10 * 60 * 60_000;

    #[test]
    fn dates_a_short_input_idle_when_input_stopped() {
        let (at_ms, payload) = transition(Threshold::Input, ext_idle_notification_v1::Event::Idled, NOW).unwrap();

        assert_eq!(at_ms, NOW - 60_000);
        assert!(matches!(payload, WindowEventPayload::InputIdle));
    }

    #[test]
    fn reports_returning_input_as_input_not_as_presence() {
        let (at_ms, payload) = transition(Threshold::Input, ext_idle_notification_v1::Event::Resumed, NOW).unwrap();

        assert_eq!(at_ms, NOW);
        assert!(matches!(payload, WindowEventPayload::InputActive));
    }

    #[test]
    fn keeps_the_five_minute_idle_as_presence() {
        let (at_ms, payload) = transition(Threshold::Away, ext_idle_notification_v1::Event::Idled, NOW).unwrap();

        assert_eq!(at_ms, NOW - 5 * 60_000);
        assert!(matches!(payload, WindowEventPayload::IdleStart));
    }
}
