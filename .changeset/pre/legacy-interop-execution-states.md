---
'@ethlete/query': patch
---

Legacy interop: `abort()` publishes `Cancelled`, a second `execute()` while loading is a no-op again, a poll reports `refreshing`, `triggerImmediately` runs at once, and `state$` replays `Prepared`.
