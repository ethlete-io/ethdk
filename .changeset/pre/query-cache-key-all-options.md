---
'@ethlete/query': patch
---

Creators that differ in `responseType`, `withCredentials`, `reportErrors`, `reportProgress` or `retryFn` no longer share one cache entry on the same URL.
