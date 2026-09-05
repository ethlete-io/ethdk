---
'@ethlete/query': patch
---

`setDefaultQueryRetryFn` is now internal, so it leaves the published types (`stripInternal`): retries stay opt-in per client through `withDefaultRetry()` or a `retryFn`, as the errors guide describes. The runtime export is unchanged.
