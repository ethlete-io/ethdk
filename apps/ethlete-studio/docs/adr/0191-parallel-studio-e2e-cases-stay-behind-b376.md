---
status: accepted
open: B377
decided: 2026-11-04
source: grill session 2026-11-04
---

# Parallel Studio e2e cases stay behind B376

A slice runs only its own Studio e2e case (`yarn studio:e2e --case <text>`); the full serial suite (over 6.5 min) runs
once per batch before a push. B377 (parallel cases on the 32 cores, vitest worker check) therefore keeps its place after
B376. Tom: "ok" to the recommendation to leave it there.
