---
'@ethlete/components': patch
---

Fix the tooltip's padding tokens having no effect when set on `et-tooltip` or an ancestor, by registering every tooltip token as inheriting.
