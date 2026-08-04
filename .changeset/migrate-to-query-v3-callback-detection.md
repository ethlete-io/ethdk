---
'@ethlete/query': patch
---

`migrate-to-query-v3` now threads an injector into `prepare()` calls inside callbacks (`computed`,
`effect`, RxJS operators) and adds `destroyOnResponse` when the prepared query is discarded.
