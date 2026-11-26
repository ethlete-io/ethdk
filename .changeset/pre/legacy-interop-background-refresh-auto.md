---
'@ethlete/query': patch
---

Interop queries now report a load they did not start (`refreshQueriesInUse()`, an invalidation) as an `auto` refresh, so `*etQuery` shows `refreshing` instead of `loading` and `ignoreAutoRefresh()` filters it.
