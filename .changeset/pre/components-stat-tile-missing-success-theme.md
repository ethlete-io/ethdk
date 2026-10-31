---
'@ethlete/components': patch
---

Fix `et-stat-tile` throwing on a coloured delta when the app registers no `success` or `error` theme; the delta now keeps the inherited theme and warns once in dev mode.
