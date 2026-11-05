---
'@ethlete/query': patch
---

`migrate-to-query-v3` reports each `prepare()`, `createSignal()` and `behaviorSubject()` call on a `legacy*` property receiver outside an injection context, with `file:line`.
