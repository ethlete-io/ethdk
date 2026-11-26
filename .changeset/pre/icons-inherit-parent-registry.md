---
'@ethlete/components': patch
---

`provideIcons()` now inherits the icons registered above it, so a consumer icon projected into an SDK component that registers its own icons no longer throws `ICON_NOT_FOUND`.
