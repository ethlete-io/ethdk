---
'@ethlete/query': patch
---

Legacy query: `v2BuildQueryCacheKey` takes the request method, so two cacheable methods on one route no longer share a query store entry. A `GET` keeps its existing key.
