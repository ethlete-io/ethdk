---
'@ethlete/query': patch
---

Query: `reset()` now detaches the query from its request, so a re-execution by another consumer of the same cache key no longer brings the reset query's `loading`, `response` and success handlers back to life.
