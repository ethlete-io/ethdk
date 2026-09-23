---
'@ethlete/query': patch
---

Query persistence: only a `QuotaExceededError` frees the oldest half of the store before the write is retried; any other write failure retries without deleting entries.
