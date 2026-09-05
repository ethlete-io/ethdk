---
'@ethlete/query': patch
---

Persistence: a secure consumer that unbinds while its request is in flight no longer stamps the shared cache entry public, which persisted authenticated data that the logout purge then skipped.
