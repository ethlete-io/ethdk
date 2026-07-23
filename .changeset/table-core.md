---
'@ethlete/components': minor
---

Add a new **Table** component (`et-table`, `TABLE_IMPORTS`) — the first phase of a type-safe, light-by-default data table.

Columns are declared with the typed helper `tableColumns<T>()`, so the row type flows into every `value` accessor (and, via each column's `key`, into state) without wiring templates to data by string. The base table renders typed rows/cells on a CSS grid with a sticky header, an empty state (`emptyLabel` or projected `[etTableEmpty]` content), per-column `width`/`align`, custom `cell`/`headerCell` templates, and a serializable, versioned `state()` / `restoreState()` for column order + visibility. Colors come from the surface theming tokens.

Sort, filter, row expansion, column reordering, virtualization and richer state persistence land in later phases.
