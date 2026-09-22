---
'@ethlete/query': minor
---

`createQueryBatch` runs one mutation over a list of items with bounded concurrency, a per-item
outcome and a `retryFailed()` that resends only what did not succeed.
