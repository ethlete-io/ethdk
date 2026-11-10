---
status: accepted
built: df49f570e
decided: 2026-11-10
source: grill session 2026-11-10 (day shift), after the B469 Mac spike
---

# Studio ships CEF on macOS

The B469 spike on the Mac (Intel x64) showed that the CEF build of Studio runs with three platform gates in the Cargo
and Tauri config: a sketch opens with live frames and no console error, and signing with a hardened runtime passes.
The cost is size: the dmg and the update grow from about 30 MiB to about 177 MiB. Notarization is blocked by the
missing Apple Developer Program membership, which blocks the WKWebView release the same way today. The macOS release
now switches to CEF, so the live view, the picture and the check use one engine (ADR 0242). Windows gets its own spike
before it switches. The Apple account for notarization is a separate topic. The human answered "q1ok" to the
recommendation to switch macOS now.
