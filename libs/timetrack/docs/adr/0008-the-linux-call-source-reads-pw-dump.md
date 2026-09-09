# The Linux call source reads pw-dump, and pairs by name

The Linux call source runs `pw-dump --monitor` as a child process and folds its JSON into a small
copy of the PipeWire registry. It does not link libpipewire, and it does not try to resolve a
capture stream back to the window that owns it.

## Why not libpipewire

The `pipewire` crate binds a C library, so a Linux build of the app would need the PipeWire
development headers on every machine that builds it, including CI. `pw-dump` ships with PipeWire
itself, prints the whole registry once and then one JSON array per change, and costs a runtime
dependency instead of a build one. A machine without it is a degraded source with a sentence saying
which package supplies it, which is a state the source design already has.

The price is a child process and one JSON parse per change. Both are small next to the alternative,
and neither is on a hot path — a change arrives when somebody joins or leaves a call.

## Why a microphone is not just a capture stream

A stream reading the speakers is a `Stream/Input/Audio` node exactly like a call's. On the machine
this was built on, `cava` runs an audio visualiser all day off the monitor of the output sink, so
treating every capture stream as a call would have put a call on every working hour.

The source therefore follows the links out of the stream's input and requires that at least one of
them comes from a node whose `media.class` is `Audio/Source`. `cava`'s come from an `Audio/Sink`.
The node must also be `running`: a stream that has opened the microphone without reading it sits at
`suspended`.

## Why the call is paired to a window by name

macOS reports a bundle id from both the window source and the audio source, so the two pair exactly
and a helper process pairs by prefix. Linux has no such identifier. The compositor reports a Wayland
app id, PipeWire reports whatever the audio client set, and neither route between them survives:

- The PipeWire props carry `application.process.id`, but Chrome and Spotify are Flatpaks here, so
  that is a PID inside the sandbox rather than one this app can look up.
- `/proc/<pid>/cgroup` names the Flatpak id — `com.google.Chrome` — and not the Wayland app id
  `google-chrome`. An app started from a terminal inherits the cgroup of whatever started it, so it
  names nothing at all.

So the source picks the property most likely to be the Wayland app id: `application.icon-name`
first, which is `google-chrome` for Chrome, then `application.process.binary`, which is `spotify`
for Spotify, then the node and application names. Measured 2026-09-09, that pairs both applications
on this machine exactly.

## Consequences

- A wrong guess costs the call its **title** and nothing else. The span is recorded either way, and
  the rules for what counts as work are regular expressions matched against this identifier as well
  as the title, so the user can always write one that fits what they see.
- A Linux install without `pipewire-utils` collects no calls, and the Sources screen says so.
- `pw-dump` ending is read as the daemon going away: every open call is closed at that instant and
  the source is degraded until the next start succeeds. A quick restart of PipeWire therefore shows
  as two calls rather than one, which is truthful about what was seen.
- The source watches PipeWire only. A call held entirely inside a browser tab that never opens the
  microphone — a listener in a webinar — is invisible to it, on every platform.
