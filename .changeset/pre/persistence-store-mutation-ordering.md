---
'@ethlete/query': patch
---

Query persistence: a logout purge or `clearPersistedQueries()` can no longer be undone by a write that was already on its way to disk, and `maxEntries` is applied at startup as well.
