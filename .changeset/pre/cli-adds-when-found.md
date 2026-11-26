---
'@ethlete/cli': minor
'@ethlete/query': patch
---

Add the manifest field `addsWhenFound`: `et update` adds a package only when a `.ts` file names one of the listed identifiers. The `to-query-v3` migration adds `@ethlete/query-devtools` only for repos that use `QueryDevtoolsComponent`.
