---
'@ethlete/query': patch
---

A legacy query container teardown now destroys the query it holds even when the request is not cacheable, so a mutation no longer stays alive and polling.
