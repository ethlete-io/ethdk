---
'@ethlete/query': patch
---

Bearer auth: a response the `extractTokens` step rejects now puts `executionState` into `error` instead of reporting a `success` that never authenticated the tab.
