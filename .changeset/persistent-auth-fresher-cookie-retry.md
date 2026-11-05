---
'@ethlete/query': patch
---

`withPersistentAuth` retries a rejected refresh once with the token a sibling host wrote to the shared cookie, instead of deleting it.
