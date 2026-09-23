---
'@ethlete/query-devtools': patch
---

The response diff now reports a changed `Blob`, `Date`, `Map` or `Set` instead of reading two
of them as identical, and searching a folded slice no longer overflows on a cyclic value.
