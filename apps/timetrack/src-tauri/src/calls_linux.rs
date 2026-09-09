use crate::calls::CallSource;
use serde::Deserialize;
use serde_json::{Deserializer, Value};
use std::collections::HashMap;
use std::io::BufReader;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

/// `pw-dump --monitor` prints the whole registry once, then one JSON array per change.
///
/// Reading it costs a runtime dependency on PipeWire's own command line tools and no build dependency
/// on libpipewire, which is what keeps a Linux build of this app buildable without audio headers. A
/// missing binary is reported as a degraded source rather than a failure — see
/// `libs/timetrack/docs/adr/0008-the-linux-call-source-reads-pw-dump.md`.
const DUMP: &str = "pw-dump";

const NO_DUMP: &str = "Timetrack cannot see which application is on a call, because `pw-dump` is not \
installed. It ships with PipeWire, in the `pipewire-utils` package on most distributions.";

/// How long to wait before starting `pw-dump` again after it has exited, which from here is what a
/// restart of the PipeWire daemon looks like.
const RESTART_DELAY: Duration = Duration::from_secs(5);

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[derive(Deserialize)]
struct Info {
    state: Option<String>,
    props: Option<HashMap<String, Value>>,
}

/// One object out of the dump.
///
/// A removal carries an `id` and nothing else, so the absent `type` is what tells the two apart. Some
/// objects that are present carry no `info` either — metadata and the profiler both do — which is why
/// absence of `info` cannot be read as removal.
#[derive(Deserialize)]
struct Object {
    id: u32,
    #[serde(rename = "type")]
    kind: Option<String>,
    info: Option<Info>,
}

#[derive(Default)]
struct Node {
    media_class: String,
    state: String,
    app_id: String,
}

struct Link {
    output_node: u32,
    input_node: u32,
}

fn text<'a>(props: &'a HashMap<String, Value>, key: &str) -> Option<&'a str> {
    props.get(key)?.as_str()
}

fn node_id(props: &HashMap<String, Value>, key: &str) -> Option<u32> {
    u32::try_from(props.get(key)?.as_u64()?).ok()
}

/// The identifier to report for an audio stream, chosen to be the one the window source calls the same
/// application by.
///
/// Linux has no identifier both sources read: the compositor reports a Wayland app id and PipeWire
/// reports whatever the audio client set. Two properties carry the Wayland app id in practice, and
/// neither carries it always, so both are tried before the names — measured on this machine
/// 2026-09-09, where the app ids are `google-chrome` and `spotify`:
///
/// - `application.icon-name` is `google-chrome` for Chrome, whose binary is only `chrome`.
/// - `application.process.binary` is `spotify` for Spotify, which sets no icon name.
///
/// A miss costs the call its title, because the read side pairs a call to a focused window by this
/// identifier. It does not cost the call: the span is still recorded, and the user's own rules for
/// what counts as work are matched against this string as well as the title.
fn app_id_of(props: &HashMap<String, Value>) -> Option<String> {
    [
        "application.icon-name",
        "application.process.binary",
        "node.name",
        "application.name",
    ]
    .into_iter()
    .filter_map(|key| text(props, key))
    .find(|value| !value.trim().is_empty())
    .map(str::to_owned)
}

/// As much of the PipeWire registry as the question "who holds the microphone" needs.
#[derive(Default)]
struct Registry {
    nodes: HashMap<u32, Node>,
    links: HashMap<u32, Link>,
}

impl Registry {
    /// Folds one object in, keeping every field the object does not carry.
    ///
    /// A change re-states the object rather than describing a diff, but it may leave out a field whose
    /// change mask says it did not change, so overwriting unconditionally would blank one.
    fn apply(&mut self, object: Object) {
        let Some(kind) = object.kind else {
            self.nodes.remove(&object.id);
            self.links.remove(&object.id);

            return;
        };

        match kind.as_str() {
            "PipeWire:Interface:Node" => {
                let Some(info) = object.info else {
                    return;
                };
                let node = self.nodes.entry(object.id).or_default();

                if let Some(state) = info.state {
                    node.state = state;
                }

                if let Some(props) = info.props {
                    if let Some(media_class) = text(&props, "media.class") {
                        node.media_class = media_class.to_owned();
                    }

                    if let Some(app_id) = app_id_of(&props) {
                        node.app_id = app_id;
                    }
                }
            }
            "PipeWire:Interface:Link" => {
                let Some(props) = object.info.and_then(|info| info.props) else {
                    return;
                };
                let Some(output_node) = node_id(&props, "link.output.node") else {
                    return;
                };
                let Some(input_node) = node_id(&props, "link.input.node") else {
                    return;
                };

                self.links.insert(
                    object.id,
                    Link {
                        output_node,
                        input_node,
                    },
                );
            }
            _ => {}
        }
    }

    fn is_capture_device(&self, id: u32) -> bool {
        self.nodes
            .get(&id)
            .is_some_and(|node| node.media_class == "Audio/Source")
    }

    /// Whether this stream is taking audio off a microphone right now.
    ///
    /// Following the links is what tells a call from an audio visualiser. `cava` reads the speakers
    /// through the monitor of an output sink, which is a `Stream/Input/Audio` node exactly like a
    /// call's; what differs is that its links come from an `Audio/Sink`. Counting it would put a call
    /// on every hour the visualiser ran, which on this machine is all of them.
    ///
    /// `running` and not merely present, because an application that has opened the microphone but is
    /// not reading it sits at `suspended` — measured 2026-09-09: a capture stream stays `suspended`
    /// for about a second after it appears, and returns there before it goes away.
    fn holds_the_microphone(&self, id: u32, node: &Node) -> bool {
        node.media_class == "Stream/Input/Audio"
            && node.state == "running"
            && self
                .links
                .values()
                .any(|link| link.input_node == id && self.is_capture_device(link.output_node))
    }

    /// Which applications hold the microphone, each named once however many streams it opened.
    ///
    /// A browser holds one stream per tab that asked, and reporting the same identifier twice would
    /// leave a call open until the last of them closed.
    fn holding(&self) -> Vec<String> {
        let mut held: Vec<String> = self
            .nodes
            .iter()
            .filter(|(id, node)| self.holds_the_microphone(**id, node))
            .filter(|(_, node)| !node.app_id.is_empty())
            .map(|(_, node)| node.app_id.clone())
            .collect();

        held.sort();
        held.dedup();

        held
    }
}

fn spawn() -> std::io::Result<Child> {
    Command::new(DUMP)
        .args(["--monitor", "--no-colors"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
}

/// Folds the dump into the registry, reconciling the source after each batch, until `pw-dump` ends.
fn read(sink: &CallSource, mut child: Child) {
    let Some(stdout) = child.stdout.take() else {
        return;
    };

    let mut registry = Registry::default();

    for batch in Deserializer::from_reader(BufReader::new(stdout)).into_iter::<Value>() {
        let Ok(batch) = batch else {
            break;
        };

        for object in match batch {
            Value::Array(objects) => objects,
            object => vec![object],
        } {
            if let Ok(object) = serde_json::from_value::<Object>(object) {
                registry.apply(object);
            }
        }

        // A paused Timetrack does not look at the machine at all, and it forgets what it saw: a call
        // that outlives the pause has to be seen to start again, or its end arrives with no opening.
        if sink.is_paused() {
            sink.forget();

            continue;
        }

        sink.reconcile(now_ms(), registry.holding());
    }

    let _ = child.kill();
    let _ = child.wait();
}

fn watch(sink: &CallSource) {
    loop {
        match spawn() {
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                sink.set_status("none", Some(NO_DUMP.to_string()));

                return;
            }
            Err(error) => sink.set_status("none", Some(format!("`{DUMP}` could not be started: {error}"))),
            Ok(child) => {
                sink.set_status("linux-pipewire", None);
                read(sink, child);

                // `pw-dump` ends when the daemon goes away, so nothing is holding a microphone this
                // source can still see. Leaving the calls open would run every one of them to the end
                // of the day.
                sink.reconcile(now_ms(), Vec::new());
                sink.set_status(
                    "none",
                    Some(format!("`{DUMP}` stopped, so PipeWire may have restarted")),
                );
            }
        }

        std::thread::sleep(RESTART_DELAY);
    }
}

/// Watches which application holds the microphone, on a thread of its own.
///
/// A panic is caught for the same reason as in the window source: the status is what the UI tells the
/// user is running, and a dead thread that still reads `linux-pipewire` is worse than no call source.
pub fn start(sink: CallSource) {
    std::thread::spawn(move || {
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| watch(&sink)));

        if outcome.is_err() {
            sink.set_status("none", Some("the call source panicked; see the host log".to_string()));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fold(registry: &mut Registry, objects: &str) {
        for object in serde_json::from_str::<Vec<Value>>(objects).unwrap() {
            registry.apply(serde_json::from_value::<Object>(object).unwrap());
        }
    }

    /// The microphone and a stream reading it, in the shape `pw-dump` prints them.
    const MICROPHONE: &str = r#"[
      { "id": 67, "type": "PipeWire:Interface:Node",
        "info": { "state": "running", "props": { "media.class": "Audio/Source", "node.name": "alsa_input.rode" } } },
      { "id": 115, "type": "PipeWire:Interface:Node",
        "info": { "state": "running", "props": {
          "media.class": "Stream/Input/Audio", "application.icon-name": "google-chrome",
          "application.process.binary": "chrome", "node.name": "Google Chrome" } } },
      { "id": 200, "type": "PipeWire:Interface:Link",
        "info": { "props": { "link.output.node": 67, "link.input.port": 116, "link.input.node": 115 } } }
    ]"#;

    /// `cava` reading the speakers, which is a capture stream off an `Audio/Sink`.
    const VISUALISER: &str = r#"[
      { "id": 69, "type": "PipeWire:Interface:Node",
        "info": { "state": "running", "props": { "media.class": "Audio/Sink", "node.name": "alsa_output.nubert" } } },
      { "id": 98, "type": "PipeWire:Interface:Node",
        "info": { "state": "running", "props": {
          "media.class": "Stream/Input/Audio", "application.process.binary": "cava", "node.name": "cava" } } },
      { "id": 201, "type": "PipeWire:Interface:Link",
        "info": { "props": { "link.output.node": 69, "link.input.node": 98 } } }
    ]"#;

    #[test]
    fn reports_the_application_reading_a_microphone() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);

        assert_eq!(registry.holding(), vec!["google-chrome".to_string()]);
    }

    #[test]
    fn ignores_a_stream_reading_the_speakers_rather_than_a_microphone() {
        let mut registry = Registry::default();

        fold(&mut registry, VISUALISER);

        assert!(registry.holding().is_empty());
    }

    #[test]
    fn reports_the_call_while_the_visualiser_runs_alongside_it() {
        let mut registry = Registry::default();

        fold(&mut registry, VISUALISER);
        fold(&mut registry, MICROPHONE);

        assert_eq!(registry.holding(), vec!["google-chrome".to_string()]);
    }

    #[test]
    fn waits_for_a_stream_to_run_before_calling_it_a_call() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);
        fold(
            &mut registry,
            r#"[{ "id": 115, "type": "PipeWire:Interface:Node", "info": { "state": "suspended" } }]"#,
        );

        assert!(registry.holding().is_empty());
    }

    #[test]
    fn keeps_what_a_change_leaves_out() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);
        fold(
            &mut registry,
            r#"[{ "id": 115, "type": "PipeWire:Interface:Node", "info": { "state": "running" } }]"#,
        );

        assert_eq!(registry.holding(), vec!["google-chrome".to_string()]);
    }

    #[test]
    fn drops_a_node_the_dump_has_removed() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);
        fold(&mut registry, r#"[{ "id": 115, "info": null }]"#);

        assert!(registry.holding().is_empty());
    }

    #[test]
    fn drops_a_link_the_dump_has_removed() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);
        fold(&mut registry, r#"[{ "id": 200, "info": null }]"#);

        assert!(registry.holding().is_empty());
    }

    #[test]
    fn names_an_application_once_however_many_streams_it_opened() {
        let mut registry = Registry::default();

        fold(&mut registry, MICROPHONE);
        fold(
            &mut registry,
            r#"[
              { "id": 130, "type": "PipeWire:Interface:Node",
                "info": { "state": "running", "props": {
                  "media.class": "Stream/Input/Audio", "application.icon-name": "google-chrome" } } },
              { "id": 202, "type": "PipeWire:Interface:Link",
                "info": { "props": { "link.output.node": 67, "link.input.node": 130 } } }
            ]"#,
        );

        assert_eq!(registry.holding(), vec!["google-chrome".to_string()]);
    }

    #[test]
    fn prefers_the_icon_name_over_the_binary_it_disagrees_with() {
        let props = serde_json::from_str(
            r#"{ "application.icon-name": "google-chrome", "application.process.binary": "chrome" }"#,
        )
        .unwrap();

        assert_eq!(app_id_of(&props), Some("google-chrome".to_string()));
    }

    #[test]
    fn falls_back_to_the_binary_for_an_application_that_sets_no_icon_name() {
        let props =
            serde_json::from_str(r#"{ "application.process.binary": "spotify", "application.name": "Spotify" }"#)
                .unwrap();

        assert_eq!(app_id_of(&props), Some("spotify".to_string()));
    }

    #[test]
    fn takes_no_identifier_from_a_stream_that_names_itself_with_nothing() {
        let props = serde_json::from_str(r#"{ "application.process.binary": "  ", "media.class": "x" }"#).unwrap();

        assert_eq!(app_id_of(&props), None);
    }
}
