---
'@ethlete/query': patch
---

`withDefaultRetry()` and `withEthleteApiErrors()` now retry only the client they are on, so a second client keeps its own retry policy, or none at all.
