---
'@ethlete/query': patch
---

Query batch: `retryFailed()` no longer resends a mutation that an unsubscribe aborted in flight, since the server may already have applied it.
