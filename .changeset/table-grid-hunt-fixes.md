---
'@ethlete/components': patch
---

Fix several table and grid edge cases:

- A virtualized table now sets `aria-rowcount` to the full row count and `aria-rowindex` on every rendered row and detail row, so a screen reader announces "row 4 812 of 10 001" instead of the window size.
- Client sorting throws `ET3514` in dev mode when a sortable column without `sortValue` reads an object, list or function, instead of sorting as a silent no-op.
- The column menu's **Hide column** clears that column's filter and sort entry, so rows are never filtered or ordered by a column nobody can see. `setSort(key, null)` now drops only that column's entry from a multi-sort.
- Grid `restoreState()` during an item's leave animation no longer removes the restored item when the animation ends.
