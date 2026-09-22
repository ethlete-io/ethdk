---
'@ethlete/query': minor
---

Retries: the default policy now backs off exponentially with jitter and gives up after
`maxAttempts` instead of retrying a connection failure every 5s forever, is configurable via
`withDefaultRetry({ … })` / `createDefaultRetryFn()`, and stops once the last consumer is gone.
