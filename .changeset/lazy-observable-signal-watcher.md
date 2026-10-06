---
'@ethlete/query': patch
---

Queries and snapshots no longer create ten effects each up front: one shared effect starts on the first `asObservable()` call, and a late subscriber gets the current value synchronously.
