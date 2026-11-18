---
status: accepted
open: none
decided: 2026-10-31
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q241
---

# A demo frame belongs only to a part's own states

An embedded render never has a frame, with no prop to set; `pages/system` and `pages/inbox` drop their Tailwind `!`
overrides in a no-visible-change round. The rule holds for every SDK part that draws a demo frame.
