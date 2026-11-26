---
'@ethlete/query': patch
---

A mutation whose `withArgs` source returns `null` while its request is in flight is no longer aborted; it finishes and the query parks once it has settled.
