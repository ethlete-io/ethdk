---
'@ethlete/query': minor
---

Behavior change: the default retry policy no longer retries a `POST`, a `PATCH` or a GraphQL mutation; opt back in with `createDefaultRetryFn({ retryNonIdempotent: true })`, and a `retryFn` now receives the request's `method` and `idempotent`.
