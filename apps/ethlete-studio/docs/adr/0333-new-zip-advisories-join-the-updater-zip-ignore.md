---
status: accepted
open: B568
decided: 2026-11-17
source: doc-agent session 2026-11-17, Rust audit red on new zip advisories
---

# New zip advisories join the updater zip ignore

The Rust audit turned red on RUSTSEC-2026-0545 and RUSTSEC-2026-0548 in zip 4.6.1, which reaches both Tauri apps only
through tauri-plugin-updater 2.x; no 2.x release moves past it. The updater extracts only a bundle whose signature it
has verified, without a password (Suspect, from a code read). Asked whether to add both to the existing zip ignore entry,
move to the updater 3 alpha, or leave the audit red, with the recommendation to ignore them like the earlier zip
advisories, the human said "ok".

Both advisories join the zip entry in the audit config of both apps, and leave with it when updater 3 is stable.
