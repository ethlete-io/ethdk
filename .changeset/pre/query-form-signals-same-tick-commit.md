---
'@ethlete/query': patch
---

Two signal query forms on one route that commit in the same tick no longer re-parse their own URL write, so no spurious commit, refetch or dropped debounce follows and a committed `Date` keeps its milliseconds.
