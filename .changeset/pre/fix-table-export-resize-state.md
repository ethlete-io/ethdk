---
'@ethlete/components': patch
---

Fix three table defects: a bound `etTableCsvExport` config making `export({ file })` throw
`ET3507`, a cancelled resize leaving a width override behind, and selection/expansion state
serializing `"[object Object]"` without a `rowKey`.
