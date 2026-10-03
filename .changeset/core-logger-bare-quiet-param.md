---
'@ethlete/core': patch
---

`createLogger` now goes quiet on a bare `?et-logger-quiet` query param, not only on one with a value. The JSDoc of `TitleConfig.prefixPart` and `suffixPart` no longer describes each other, and `UnsavedChangesTabConfig.title` no longer names the removed `etSeo` directive.
