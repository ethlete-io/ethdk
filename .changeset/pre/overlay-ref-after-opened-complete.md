---
'@ethlete/components': patch
---

Complete `OverlayRef.afterOpened()` when the overlay closes before it finished opening, so subscribers no longer wait forever.
