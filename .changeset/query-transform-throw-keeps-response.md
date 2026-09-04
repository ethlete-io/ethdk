---
'@ethlete/query': patch
---

A `transformResponse` that throws no longer resets `response()` to `null` - the last good response stays, as documented.
