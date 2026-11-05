---
'@ethlete/query': patch
---

A legacy creator's `prepare()` returns the same query for equal arguments in one injector scope, as v2 did. A `queryComputed` that calls `prepare()` no longer loops on NG0103.
