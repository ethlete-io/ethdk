---
'@ethlete/query': minor
---

Legacy interop: containers accept `{ injector }` like `prepare()` does and default their cleanup by
request method again, and `provideLegacyPrepareFallback()` lets `prepare()` use the root injector instead
of throwing ET950 (browser only).
