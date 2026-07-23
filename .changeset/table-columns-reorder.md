---
'@ethlete/components': minor
---

Table: add column reordering and visibility. `reorderable` lets users drag column headers to reorder them — a floating ghost of the header follows the pointer, a drop indicator shows where it lands, the table only reorders on drop, and the columns then animate into place. Order and visibility are also programmatic — `moveColumn(key, toIndex)`, `isColumnVisible`/`setColumnVisible`/`toggleColumnVisibility` — so consumers can build a column chooser; both are captured by `state()` and restored by `restoreState()`.
