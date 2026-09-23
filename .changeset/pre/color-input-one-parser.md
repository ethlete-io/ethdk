---
'@ethlete/components': patch
---

Color input: `rgbColor({ allowAlpha: true })` no longer accepts a malformed alpha component such as `rgb(1 2 3 / .)`, which the picker could never read.
