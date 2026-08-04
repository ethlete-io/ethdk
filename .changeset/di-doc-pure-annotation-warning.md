---
'@ethlete/core': patch
---

The provider-definition doc comments no longer spell the pure annotation out verbatim, so Rollup stops warning about (and stripping) an annotation it cannot attach to a call while bundling `@ethlete/core`.
