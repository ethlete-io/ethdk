---
'@ethlete/components': patch
---

Fix the `--et-stream-consent-*` tokens having no effect when set on `et-stream-consent` or an ancestor, by registering them as inheriting.
