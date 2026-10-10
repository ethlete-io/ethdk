---
'@ethlete/query': patch
---

Fix `keepUnusedFor: Infinity` evicting at once, a hanging `executeUntilSettled` on a parked query or query group member, an optimistic update left behind when building the request throws, `gql` printing a `false` interpolation and GET variable key order splitting the cache, and four legacy `request()` bugs.
