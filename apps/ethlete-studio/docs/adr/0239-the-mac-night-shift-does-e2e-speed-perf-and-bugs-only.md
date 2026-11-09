---
status: accepted
open: B249
decided: 2026-11-09
source: grill session 2026-11-09
---

# The Mac night shift does e2e speed, perf and bugs only

The desk PC sessions stop at 18:00 on 2026-11-09; a night shift goes on on the Mac, from `origin/next`.

- Scope, in this order: the Studio e2e step gets faster (the rest of the wait item: the picture delay in the repeat
  gate, the measurement against 90 s on the idle Mac, the disk check cache if needed, the 647 bite proof through the
  push-suite export), then perf, then bug fixes. No new features and no new systems, so not "build ready" either. The
  human: "die nachtschicht arbeitet nur an dingen wie e2e schneller, perf verbessern und erst dann bugs ausbessern.
  keine neuen features da ich diese nicht abnehmen kann. das ist arbeit für die tagschicht wo ich dann auch da bin."
- A builder and a grill/docs session run on the Mac, as on the PC; questions for the human are collected for the
  morning. The human: "q2ok".
- Watchdogs after each usage limit reset (01:35, 06:35, 11:35) resume a stopped session. The human: "wecker sollten
  wir stellen zur sicherheit auch wenn es eher unwarscheinlich ist dass wir in limits laufen hier."
- Push only after a green push suite; no endless e2e fix loop.
