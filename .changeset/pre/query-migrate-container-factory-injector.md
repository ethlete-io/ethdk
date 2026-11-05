---
'@ethlete/query': patch
---

`migrate-to-query-v3` also passes an injector to `createSubject()`, `createSignal()` and `behaviorSubject()` calls on a legacy creator that run outside an injection context, as it did for `prepare()`.
