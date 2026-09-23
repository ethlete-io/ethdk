---
'@ethlete/components': patch
---

`et-picture` with `aspectRatio` (and no `width`) now reserves its box on the `<picture>`, so the space exists before the image or its URL arrives; the image fills the host's inline size at that ratio.
