---
'@ethlete/query': major
---

`setupQueryTest` now rethrows non-request errors, `setupAuthTest` retries 401s by default, and `mintTestToken` is exported from the testing entry.

The proactive refresh keeps its time on a late recompute, `isExpiringSoon` ignores routine refreshes, and dates reach the URL as ISO strings.
