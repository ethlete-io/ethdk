---
'@ethlete/components': patch
---

`getColorContrastRatio`/`colorContrast` now parse hex and `rgb()`/`rgba()` through the same internal parser the color picker uses, instead of a duplicate; `hsl()` stays rejected as documented.
