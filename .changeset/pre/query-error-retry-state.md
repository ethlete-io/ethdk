---
'@ethlete/query': patch
---

A query error's `retryState.retry` now says whether a manual retry is worth offering, even after automatic retries are exhausted or without `withDefaultRetry()`; a configured retry policy alone decides it, so `<et-query-error>` shows Retry without `alwaysAllowRetry`.
