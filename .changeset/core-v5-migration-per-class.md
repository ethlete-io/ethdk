---
'@ethlete/core': patch
---

The `migrate-to-v5` generator now migrates `ViewportService` and `RouterStateService` per class, leaves classes that do not inject them untouched, and handles aliased imports.
