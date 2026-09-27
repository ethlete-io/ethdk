---
'@ethlete/query': patch
---

`migrate-to-query-v3` now renames only identifiers bound to the migrated client, keeps default and `type` imports, resolves `.js` and `baseUrl` imports, rewrites `.prepare()` only on legacy creators, and merges a scoped run into the existing report.
