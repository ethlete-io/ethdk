---
'@ethlete/query': patch
---

`withPolling` executions now report `triggeredBy()` as `'polling'` and `withAutoRefresh` executions as `'auto-refresh'`, so a UI can tell a background refresh from a user-started load.
