use crate::calls_linux::OWN_STREAM_PROPERTY;
use std::process::{Child, Command, Stdio};

/// Records the default audio source, the microphone, as raw 16 kHz mono `f32` on stdout.
///
/// No `--target` and no `stream.capture.sink`: a capture stream then links to the default source and
/// never to a sink's monitor, which is where the other participants of a call would be heard.
pub fn record_args() -> Vec<String> {
    [
        "--raw",
        "--rate",
        "16000",
        "--channels",
        "1",
        "--format",
        "f32",
        "-P",
        &format!("{{ node.name = \"timetrack-transcribe\" {OWN_STREAM_PROPERTY} = true }}"),
        "-",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

pub fn spawn() -> std::io::Result<Child> {
    Command::new("pw-record")
        .args(record_args())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_the_microphone_and_never_the_call_output() {
        let args = record_args();

        assert!(!args
            .iter()
            .any(|arg| arg.contains("capture.sink") || arg.contains("monitor")));
        assert!(!args.iter().any(|arg| arg == "--target"));
        assert_eq!(args.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn marks_its_stream_so_the_call_source_does_not_count_it_as_a_call() {
        assert!(record_args().iter().any(|arg| arg.contains(OWN_STREAM_PROPERTY)));
    }
}
