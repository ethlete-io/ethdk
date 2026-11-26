---
'@ethlete/query': patch
---

Legacy v2 queries that differ only in headers are now cached separately, `InfinityQuery` retries a failed page instead of skipping it, and `poll()` works again after `stopPolling()` ran while polling was blur-paused.
