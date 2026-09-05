---
'@ethlete/query': patch
---

Query: a `transformResponse` that throws lands in `error()` with code `0`, keeps the last good `response()`, and no longer re-runs `withSuccessHandling`.
