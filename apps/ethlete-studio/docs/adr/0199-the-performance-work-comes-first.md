---
status: accepted
open: 477
decided: 2026-11-06
source: grill session 2026-11-06
---

# The performance work comes first

Tom: "die perf sachen würde ich gerne vorziehen das bringt uns dann allgemein speed für alles andere". A
`design compare` of `components/title-bar` took 44.9 s, and the UI builder runs it at every step.

The tool builder finishes the slice B rework of finding 482, which was built and already in its design check. Then the
open performance items run as one block, before findings 481, 483 and 484: (1) finding 477, `design compare` first
(phase timing, the harness that starts twice), then `sketch ready` and `sketch check`, each with phase timing and a
time budget; (2) C1, the hit rate of the harness build cache; (3) C4, the full `design check` of Studio (about 6:30);
(4) B392, split `check-system.spec.ts`, which holds 89 of 97 s of `nx test cli`. The UI builder goes on with its own
work. Tom: "ok".
