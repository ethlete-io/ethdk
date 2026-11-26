---
'@ethlete/query': patch
---

`prep-for-query-v3` now handles re-exported `CLEAR_QUERY_ARGS`, leaves shadowing local names alone, and checks `withArgs` callbacks passed by reference, listing the ones it cannot follow.
