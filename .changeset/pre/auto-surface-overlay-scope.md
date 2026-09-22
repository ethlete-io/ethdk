---
'@ethlete/core': patch
'@ethlete/components': patch
---

`etAutoSurface`: opening an overlay (date-picker, select, menu, …) no longer elevates unrelated surfaces on the base page. The overlay surface-context tracker is now matched by DOM containment, so an `etAutoSurface` only adopts an overlay's elevation when it actually renders inside that overlay's pane.
