---
'@ethlete/query': patch
---

The `migrate-to-query-v3` generator keeps `AnyV2Query` in a file that already names `AnyLegacyQuery`, so a union of both no longer collapses into one type with a duplicate import.
