---
'@ethlete/components': patch
---

Overlay: the anchored overlay arrow (tooltip, toggletip, anchored dialog) no longer flashes for a frame before the enter animation starts. The arrow now stays hidden while the overlay is still waiting to animate in, instead of briefly appearing, disappearing, and fading in again.
