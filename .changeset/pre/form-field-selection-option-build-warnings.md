---
'@ethlete/components': patch
---

Drop the unused `DescriptionComponent` import from the checkbox-option and radio components (both only project `et-description` via `<ng-content>`), clearing the NG8113 unused-import build warnings.
