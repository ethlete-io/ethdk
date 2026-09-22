---
'@ethlete/query': minor
---

Query stack: a custom `transform` is now typed with the `null` responses it actually receives (a compile-time break for callbacks that assumed otherwise), and `lastQuery` no longer points at a query `maxQueries` just evicted.
