---
'@ethlete/query': minor
---

Queries keep the previous response while new `withArgs` args load (as `executionState().cachedResponse`) and clear it when parked; opt out per query with `keepPreviousResponse: false`.
