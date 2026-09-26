---
'@ethlete/query': patch
---

A query error's `retryState.retry` now says whether a manual retry is worth offering - `true` for a transient failure (a connection failure, `408`, `425`, `429`, a 5xx above `500` on an idempotent request, or anything the request's `retryFn` would retry) even after the automatic retries are exhausted, and also on a client without `withDefaultRetry()`. It used to read `false` in both cases, so `<et-query-error>` only offered its Retry button with `alwaysAllowRetry`.

A configured retry policy now decides `retryState.retry` on its own: a status left out of `withDefaultRetry({ retryableStatusCodes })`, or declined by a client or creator `retryFn`, reads `false`. The built-in classification applies only on a client with no policy at all.
