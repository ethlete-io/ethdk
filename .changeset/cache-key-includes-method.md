---
'@ethlete/query': patch
---

The cache key now includes the request method, so a `HEAD`, an `OPTIONS` and a GraphQL query over POST on one route each get their own entry instead of sharing one.
