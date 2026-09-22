---
'@ethlete/components': minor
---

Masonry: new `etMasonry` / `etMasonryItem` directives - column-balancing layout for variable-height cards.
Items are measured continuously, so late-loading content reflows, and they keep their column when one grows.
Gate infinite scroll on `isSettled()`.
