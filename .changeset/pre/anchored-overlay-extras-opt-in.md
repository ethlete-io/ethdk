---
'@ethlete/components': minor
---

Breaking: `anchoredOverlayStrategy` no longer bundles floating-ui's `size`, `arrow` and `hide` middleware; call `enableAnchoredOverlayPositionExtras()` from `@ethlete/core` when you use `autoResize`, `autoHide`, `autoCloseIfReferenceHidden` or `arrow` with it.
