---
'@ethlete/core': major
'@ethlete/components': patch
---

Overlay runtime: build anchored strategies with `anchoredOverlayPosition({ referenceElement, … })`
instead of a `{ kind: 'anchored', … }` literal - it is what pulls `@floating-ui/dom` in, so apps
that only center dialogs no longer bundle it (~7 kB gz). `autoResize`, `autoHide`,
`autoCloseIfReferenceHidden` and arrows additionally need `enableAnchoredOverlayPositionExtras()`.
