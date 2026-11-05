---
'@ethlete/query': patch
---

`migrate-to-query-v3` no longer copies a v2 `retryFn` into `createQueryClient` and no longer adds `withEthleteApiErrors()` to Contentful, Shopify or Bynder clients. It reports a task for each instead.
