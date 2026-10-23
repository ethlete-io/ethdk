---
'@ethlete/components': patch
---

An overlay strategy that sets `arrow` without `enableAnchoredOverlayPositionExtras()` now throws `ET1212` in dev mode instead of silently rendering no arrow.
