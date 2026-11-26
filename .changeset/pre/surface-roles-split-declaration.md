---
'@ethlete/core': patch
---

`migrate-surface-roles` rewrites a declaration of a surface interaction token into both the tint and the control text token, so a `color-mix()` reader renamed to the tint still finds a value.
