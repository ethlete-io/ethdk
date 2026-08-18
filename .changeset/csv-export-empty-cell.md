---
'@ethlete/components': patch
---

A CSV export now writes an empty field for a column whose `exportValue` reports an empty cell,
instead of falling back to the column's `value` - which wrote `[object Object]` whenever that value
was an object.
