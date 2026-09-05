---
'@ethlete/query': minor
---

HTTP queries: add `createHeadQuery` and `createOptionsQuery` (plus their `createSecure…` twins), so `HEAD` and `OPTIONS` reads go through the same creators as `GET`.
