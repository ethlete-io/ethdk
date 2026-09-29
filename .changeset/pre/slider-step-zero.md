---
'@ethlete/components': patch
---

`et-slider` and `et-range-slider` treat a `step` of zero or below as `1` instead of rendering and committing `NaN`.
