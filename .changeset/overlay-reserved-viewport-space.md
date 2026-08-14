---
'@ethlete/core': minor
'@ethlete/components': patch
'@ethlete/query-devtools': patch
---

Overlays and floating chrome now keep out of space a surface above the page reserved with `reserveOverlayViewportSpace()` - so a dialog, menu or toast is no longer stacked under the docked query devtools panel.
