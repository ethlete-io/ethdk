---
'@ethlete/query': minor
---

`withDefaultRetry()` and `withEthleteApiErrors()` now retry only the client they are on. Before, the first call installed the policy process-wide. Migration: add the feature to every client that should retry - a second client without it no longer retries.
