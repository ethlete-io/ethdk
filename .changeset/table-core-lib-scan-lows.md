---
'@ethlete/components': patch
---

`rowClick` now ignores clicks on labels, editable text, control-role elements and `aria-haspopup` triggers; a rows source error without text falls back to the table's `error` label; `etTableStatePersistence` outside a table throws ET3501.
