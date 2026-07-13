---
'@ethlete/query': patch
---

Query cache: a cached request now correctly becomes stale once its freshness
window (from `cache-control` / `expires`) elapses, so `execute({ allowCache: true })`
refetches instead of serving the cached response forever.
