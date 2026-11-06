---
status: accepted
open: B405
decided: 2026-11-06
source: grill session 2026-11-06
---

# Old implementation drift goes to a shrinking baseline

The pre-push gate refused the A1 push because eight implemented parts were uncompared. Three of them show drift older
than A1 (finding 495): `pages/sketches`, `pages/system` and `elements/canvas-frames`. Like a new design rule (ADR 0201),
these old hits go into a baseline list for the implementation compare: the list may only shrink, the gate still fails
on every new drift and on every part not on the list, and each entry is a finding that opens a sketch or a UI item for
its fix. The push of next goes once the compare corner anti-alias tolerance (finding 494) is in and studio-menu and
start are verified. Tom: "q1b" (option b, recommended).
