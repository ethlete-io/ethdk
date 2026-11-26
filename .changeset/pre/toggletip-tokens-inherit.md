---
'@ethlete/components': patch
---

Fix the toggletip's padding and gap tokens having no effect when set on `et-toggletip` or an ancestor, by registering every toggletip token as inheriting.
