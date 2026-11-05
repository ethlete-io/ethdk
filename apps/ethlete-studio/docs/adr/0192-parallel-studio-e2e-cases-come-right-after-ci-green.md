---
status: accepted
open: B377
decided: 2026-11-05
source: grill session 2026-11-05
---

# Parallel Studio e2e cases come right after CI green

The full serial `yarn studio:e2e` run took 12 min 10 s (114 cases, B367b), not the 6.5 min that ADR 0191 assumed. It
runs once per batch before every push. B377 (parallel cases on the 32 cores, vitest worker check) therefore moves to
right after "CI green". Tom: "q1ok" to the recommendation to move it.

Same round: the 15 unpushed commits on `next` wait until the builder's CI slice is green, and go out with it. Tom:
"q2ok wir warten".
