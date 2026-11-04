---
status: accepted
open: none
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q228
---

# Popovers in pages embed an SDK anchored-dialog part

The SDK system gets a small `components/anchored-dialog` part; one sketch round each for `pages/system` and
`pages/inbox` embeds it instead of the direct `anchoredDialog()` mock call. The other direct mock calls follow Q219
with sketch rounds.
