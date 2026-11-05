---
'@ethlete/query': patch
---

A legacy `prepare()` on `createLegacyQueryCreator` queries now honours its `mock` argument: the query settles with the mock response or error after the delay and reports its progress.
