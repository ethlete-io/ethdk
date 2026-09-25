---
'@ethlete/query': patch
---

Calling `execute()` or `reset()` on a query inside an `effect` no longer re-runs the effect in an endless request loop.
