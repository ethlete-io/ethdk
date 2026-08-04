---
'@ethlete/query': minor
'@ethlete/components': minor
---

Surface retries and transfer progress in the query devtools: `request.subtle.attempts()` and
`request.subtle.retryState()` report what a retry policy is doing, and the panel shows backoff
countdowns, attempt counts and a progress bar for `reportProgress` requests.
