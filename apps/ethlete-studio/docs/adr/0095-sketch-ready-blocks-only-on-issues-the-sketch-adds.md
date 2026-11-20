---
status: accepted
open: none
decided: 2026-10-31
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q243
---

# sketch ready blocks only on issues the sketch adds

An issue the merged part already shows (same rule and detail, element path normalised for the ADR 0093 frame move)
does not block, for every rule. OVERFLOW and CONTROL-PART-INPUT match without their detail: a changed
pixel size of the same overflow is the same issue (applied by the doc agent to #3190, built: f8bd27c99). Old issues stay visible in `design check` and still need a fix.
