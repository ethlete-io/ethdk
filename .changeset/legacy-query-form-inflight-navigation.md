---
'@ethlete/query': patch
---

Query forms (legacy `QueryForm`): `unobserve()` and a value commit no longer cancel a route change that is already in flight, and leave the landing route's own params in place.
