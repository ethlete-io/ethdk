---
'@ethlete/core': patch
'@ethlete/components': patch
---

Overlay dialogs, sheets and full-screen dialogs now skip their enter/leave motion under `prefers-reduced-motion`, matching tooltip/menu/toggletip. Fixes the animation lifecycle getting stuck under reduced motion, which could leave focus and `overlayRef.afterOpened()` never firing.
