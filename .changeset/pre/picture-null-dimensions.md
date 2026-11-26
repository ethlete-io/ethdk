---
'@ethlete/components': patch
---

`et-picture` treats a `width` or `height` bound to `null` (or to a non-number) as unset, instead of writing `NaN` and dropping the reserved `aspectRatio`.
