---
'@ethlete/query': patch
---

`execute({ args })` without `withArgs` now records the args so a bare `execute()` re-sends them and polling does not execute twice; refreshes update `lastTimeExecutedAt()` and `triggeredBy()`, and `subtle.setResponse` no longer re-runs `transformResponse`.
