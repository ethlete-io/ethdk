---
'@ethlete/query': minor
---

Add `withOptimisticUpdate`, which writes a mutation's expected result into the cached reads its `target` matches before the request and rolls it back on failure.
