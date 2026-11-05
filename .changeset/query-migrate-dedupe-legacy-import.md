---
'@ethlete/query': patch
---

The `migrate-to-query-v3` generator no longer imports `AnyLegacyQuery` twice when a file imported both `AnyLegacyQuery` and `AnyV2Query`.
