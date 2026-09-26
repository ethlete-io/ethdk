---
'@ethlete/query': patch
---

`execute({ args })` without `withArgs` now sets `args()` so a bare `execute()` re-sends them (GQL queries too), refreshes and invalidations update `lastTimeExecutedAt()` and `triggeredBy()`, and `subtle.setResponse` no longer runs `transformResponse` again.

On a `withPolling({ executeInitially: true })` query without `withArgs`, `execute({ args })` no longer makes polling execute a second time; the interval restarts from that execution.
