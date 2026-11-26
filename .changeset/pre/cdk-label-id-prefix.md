---
'@ethlete/cdk': patch
---

The legacy `et-label` now generates ids with an `et-cdk-label-` prefix, so a page that renders it next to the `@ethlete/components` label no longer gets two elements with the same id.
