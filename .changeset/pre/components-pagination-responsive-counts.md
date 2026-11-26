---
'@ethlete/components': patch
---

A responsive `et-pagination` now trims its page window to the available width when `boundaryCount` is `0` or `NaN`, or `siblingCount` is `NaN`, instead of rendering the full window.
