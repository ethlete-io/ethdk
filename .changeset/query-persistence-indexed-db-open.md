---
'@ethlete/query': patch
---

Query persistence: a failed IndexedDB open is retried on the next access instead of disabling the store for the session, and a connection that arrives after a blocked open is closed.
