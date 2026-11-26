---
'@ethlete/query': minor
---

Queries expose the resolved request URL as `url()` (interop queries as `query.url`), and `retryableStatusCodes` also takes a `(status, isRetryableByDefault) => boolean` predicate to add a status to the defaults.
