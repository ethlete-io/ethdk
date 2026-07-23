---
'@ethlete/components': minor
---

Table: add column reordering and visibility. `reorderable` lets users drag column headers to reorder them (pure column-order state, no DOM surgery). Order and visibility are also programmatic — `moveColumn(key, toIndex)`, `isColumnVisible`/`setColumnVisible`/`toggleColumnVisibility` — so consumers can build a column chooser; both are captured by `state()` and restored by `restoreState()`.
