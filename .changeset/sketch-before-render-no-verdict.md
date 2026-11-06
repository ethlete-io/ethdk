---
'@ethlete/cli': patch
---

`et design sketch ready` and `sketch check` end as "no verdict - …, retry" when the base part does not draw in time, instead of counting its problems as sketch problems. The part draw timeout now scales with the machine load. `sketch check` reports SKETCH-BASE-STALE also for a base that changed while it ran, and `sketch rebase` skips a product change a variant already holds.
