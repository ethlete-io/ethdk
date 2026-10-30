---
'@ethlete/cdk': patch
---

The `to-v5` migration now renames `theme` and `altTheme` to `color` and `altColor` only on `et-button`, `et-fab`, `et-icon-button` and `et-text-button` hosts, not on app components with their own `theme` input.
