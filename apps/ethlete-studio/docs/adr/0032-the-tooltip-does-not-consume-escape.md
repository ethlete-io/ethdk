---
status: accepted
open: none
decided: 2026-11-04
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Solo focus, sketch view, behavior tests and pre-push decisions", tooltip and Escape
---

# The tooltip does not consume Escape

The tooltip still shows on keyboard focus, but one Escape closes it and lets the grid return focus to the cell (test
302 unchanged). The fix lives in the tooltip, so every grid with tooltips gains.
