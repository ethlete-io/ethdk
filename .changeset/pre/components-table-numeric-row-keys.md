---
'@ethlete/components': patch
---

A table's numeric `rowKey` now stays a number in selection, expansion and saved state, so a consumer's `new Set([3])` selects the row instead of matching nothing.
