---
'@ethlete/query': patch
---

Persistence: a `clearPersistedQueries()` that finishes while the store index is still loading now
leaves the index - and the devtools "on disk" count - empty instead of reporting removed entries.
