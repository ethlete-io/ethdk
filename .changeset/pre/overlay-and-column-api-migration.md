---
'@ethlete/components': patch
---

`et update` migrates overlay callbacks typed `T | null`, `injectCommandPalette` and `TableColumnVisibilityHost.allColumns` to the current API, and stops with each `file:line` it cannot rewrite.
