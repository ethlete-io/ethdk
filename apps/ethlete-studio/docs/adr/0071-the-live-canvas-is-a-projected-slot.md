---
status: accepted
built: 78f1cd587
decided: 2026-10-31
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q222
---

# The live canvas is a projected slot

A page part marks the live canvas as a projected region (`slot('canvas')`); compare masks that box in both shots, and
the component projects it with `<ng-content>`. No separate canvas part.
