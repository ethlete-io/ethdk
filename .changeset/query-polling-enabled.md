---
'@ethlete/query': minor
---

Query: `withPolling`, `withLongPolling` and `withAutoRefresh` take an `enabled` signal and run only while it is `true`, which replaces stopping a poll with `takeUntil`.
