---
'@ethlete/query': patch
---

Two signal query forms on one route that commit in the same tick no longer re-parse their own URL write. Each form now recognises its own output in the landed navigation, so a committed `Date` keeps its milliseconds and no spurious commit, refetch or dropped debounce follows.
