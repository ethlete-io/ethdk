---
'@ethlete/query': patch
---

`withSuccessHandling` no longer runs when a `transformResponse` throws - it used to fire a second time with the previous response.
