---
'@ethlete/components': patch
---

Overlay sheets: fix the black gap that appeared at the docked edge while a sheet sprang into view. The enter spring overshoots slightly past the docked edge, and the filler meant to cover that gap was an `::after` strip positioned just outside the host — which sheets clip away with their `overflow: hidden` (kept for the rounded corners), so nothing painted and the page background showed through (most visible with sheets whose surface is painted on nested content, e.g. the date picker). The filler is now a solid offset `box-shadow` in the surface color, which is not clipped by the host's own overflow and needs no change to the corner clipping.
