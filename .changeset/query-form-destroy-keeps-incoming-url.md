---
'@ethlete/query': patch
---

Query forms: `unobserve()` no longer strips same-named query params (`page`, `search`) off the URL you are navigating to when a route change is already in flight.
