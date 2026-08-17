---
'@ethlete/components': patch
---

Table: `restoreState` keeps the sort and the filters a bound `rowsSource` publishes, so a layout-only state no longer drops the header's sort arrow while the rows stay sorted.
