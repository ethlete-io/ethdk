---
'@ethlete/components': patch
---

`et-duration-input` now accepts `aria-label` and `aria-labelledby` and forwards them onto its field,
so a duration field with no projected `et-label` can be named instead of throwing `ET2201`.
