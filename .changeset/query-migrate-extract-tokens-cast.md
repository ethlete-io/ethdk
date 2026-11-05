---
'@ethlete/query': patch
---

The query v3 migration now casts the `responseAdapter` result in the scaffolded `extractTokens`, so the generated code no longer fails with TS2339 on `token`.
