---
'@ethlete/query': patch
---

Legacy interop: a superseded mutation still in flight in a query container is no longer cancelled - it reaches the server and is torn down once it has settled.
