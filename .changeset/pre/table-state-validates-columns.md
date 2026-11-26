---
'@ethlete/components': patch
---

`deserializeTableState()` and `restoreState()` reject a column state with a malformed `sort`, `filterValues`, `width` or `sortPriority`, so a hand-edited link no longer breaks the table.
