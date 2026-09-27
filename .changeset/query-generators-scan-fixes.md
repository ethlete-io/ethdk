---
'@ethlete/query': patch
---

`migrate-to-query-v3` now renames only identifiers bound to the migrated client, keeps default and `type` imports, migrates an aliased `QueryDevtoolsComponent`, only rewrites `.prepare()` on legacy query creators, and merges a scoped run into the existing task report.
