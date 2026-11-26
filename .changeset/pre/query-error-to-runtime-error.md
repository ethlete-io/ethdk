---
'@ethlete/query': patch
---

Internal: route-building and legacy query-state errors now throw `RuntimeError` (from `@ethlete/core`) instead of the ad hoc `QueryError` class, which is removed.
