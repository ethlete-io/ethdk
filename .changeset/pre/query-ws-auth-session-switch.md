---
'@ethlete/query': minor
---

A web socket client with an `authProvider` now reconnects on user switches and logouts, rejoins rooms after login and drops stale emits; the bearer auth provider gains `sessionId()`.
