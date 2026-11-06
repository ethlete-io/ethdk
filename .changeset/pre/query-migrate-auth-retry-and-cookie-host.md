---
'@ethlete/query': patch
---

The `migrate-to-query-v3` generator writes `retryConfig: { maxAttempts: 8 }` into the refresh query of the auth scaffold and warns that the login cookie is per host. The migration guide names both behaviors.
