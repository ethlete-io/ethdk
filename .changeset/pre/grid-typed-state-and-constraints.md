---
'@ethlete/components': minor
---

Grid: `et-grid` is generic in the item payload, so `layoutChange` / `getSerializedState()` hand your
own type back instead of `unknown`, and an `et-grid-item` span input now refines a registered type's
constraints instead of being ignored.
