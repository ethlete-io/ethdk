---
'@ethlete/core': patch
'@ethlete/components': patch
---

- `etAutoSurface`, `et-grid-item` and `et-form-field` elevate above an app's root surface, instead of staying inherited.
- An unset `etProvideSurface` reports the surface it inherits, so content below it no longer resolves one elevation too low.
- Adds `injectParentSurface()`.
