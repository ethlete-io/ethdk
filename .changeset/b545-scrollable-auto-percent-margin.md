---
'@ethlete/components': patch
---

With `itemSize: 'auto'`, a percent margin on an `et-scrollable` child (e.g. `margin-inline-end: 10%` on the last one) now resolves against the scroll container, so trailing space no longer needs a `scrollableClass`.
