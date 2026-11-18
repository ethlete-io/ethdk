---
'@ethlete/components': patch
---

`et-select` and `et-cascader` handle panel keys such as Escape as soon as the panel reopens, also while the previous panel is still animating out. Before, keys pressed in that window were lost.
