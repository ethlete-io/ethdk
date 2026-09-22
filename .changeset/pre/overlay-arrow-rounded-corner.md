---
'@ethlete/components': patch
'@ethlete/core': patch
---

Overlay: the anchored arrow no longer rides into a pane's rounded corner on aligned placements or when a pane
shifts near a viewport edge. `arrowPadding` now measures the arrow's actual base, so it means "how close the
arrow may get to the corners" - tooltip and toggletip default to `20` (was `8`), a bare anchored strategy to
`12` (was `4`).
