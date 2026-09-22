---
'@ethlete/query': patch
---

`refreshQueriesInUse()` and `invalidateQueries()` now only re-fire reads, so a cached auth `POST` is never replayed. GraphQL queries over `POST` keep refreshing.
