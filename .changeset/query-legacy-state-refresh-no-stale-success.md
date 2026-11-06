---
'@ethlete/query': patch
---

A subscriber that attaches to a legacy query's `state$` right after `execute()` no longer receives the previous `Success` after `Loading`, so `filterSuccess(), take(1)` waits for the new response.
