---
'@ethlete/query': patch
---

Persistence: `whenPersistenceReady` now resolves when a custom adapter's `loadIndex` throws synchronously instead of rejecting.
