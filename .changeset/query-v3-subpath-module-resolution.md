---
'@ethlete/query': patch
---

`migrate-to-query-v3` reports every tsconfig that resolves modules with `node` while its project imports an `@ethlete/*` subpath such as `@ethlete/query-devtools/lazy`, directly or through a `paths` alias.
