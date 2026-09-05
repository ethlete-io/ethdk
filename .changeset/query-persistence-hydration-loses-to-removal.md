---
'@ethlete/query': patch
---

Query persistence: a body still being read when a logout purge or `clearPersistedQueries()` finishes is dropped instead of applied.
