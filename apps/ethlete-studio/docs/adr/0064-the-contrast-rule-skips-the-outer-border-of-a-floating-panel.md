---
status: accepted
built: 67a8690d7
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q216 (option A)
---

# The contrast rule skips the outer border of a floating panel

A floating panel (an overlay pane, or an element with its own surface step and shadow) is not checked for its outer
border; the SDK overlay border stays at 1.63:1 (WCAG 1.4.11). A tool fix, no per-part exceptions.
