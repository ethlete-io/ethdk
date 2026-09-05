---
'@ethlete/query': patch
---

`buildQueryCacheKey` lowercases header names before it sorts them, so the same headers in a different casing derive one cache entry instead of two.
