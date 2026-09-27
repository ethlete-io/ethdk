---
'@ethlete/query': patch
---

`migrate-to-query-v3` now renames only identifiers bound to the migrated client, keeps default and `type` imports, migrates an aliased `QueryDevtoolsComponent`, only rewrites `.prepare()` on legacy query creators, and merges a scoped run into the existing task report.

`migrate-to-query-v3` resolves imports written with a `.js` extension and against the tsconfig `baseUrl`, renames a client import it cannot resolve by name and reports the file, and reports an unresolved empty `.prepare()` in files that do not import `@ethlete/query`.
