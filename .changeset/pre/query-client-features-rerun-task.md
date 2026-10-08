---
'@ethlete/query': patch
---

The `migrate-query-client-features` migration no longer records a "createQueryClient already has a features array" task for a client that has a `features` array and neither `multiTabSync` nor `persistence`, so running it again over its own output reports nothing.
