---
status: accepted
open: B480
decided: 2026-11-10
source: chat with the doc agent 2026-11-10 (night)
---

# The Windows CEF spike runs on the rack guest PC

This changes the wait of ADR 0250. The human said: "ich denk wir wollen auch cef auf windows." The guest game PC
`rack` (Windows 11 Pro, i9-13900HX, 64 GB) is now reachable over SSH. It has no graphics card, but its integrated GPU
is real hardware, not the virtual GPU of a VM. The Windows CEF spike (build, live frames, bundle size, signing, as in
ADR 0242 and ADR 0249) therefore runs on `rack` and does not wait for the move of the human's PC to Windows.

A builder installs the Windows toolchain (Node, Yarn, Git, Rust with the MSVC target) natively on Windows, not in WSL,
in a scratch checkout next to the game setup, which stays untouched. The work runs after the night shift of ADR 0257.
The human confirmed this summary with "passt", and then said: "der gast pc wird die nächsten wochen nicht gebraucht.
er gehört ganz dem builder". So the builder may use `rack` at any time in the coming weeks; the game setup files stay as
they are, so that guests can play on it again later.
