---
'@ethlete/query': patch
---

A secure query whose auth query failed now reports that error instead of an idle state, and `createSnapshot()` keeps the error of a failed query that still holds a cached response.
