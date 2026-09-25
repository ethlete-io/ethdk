---
'@ethlete/query': patch
'@ethlete/agent-rules': patch
---

The `ET100` error now says mutations need `withArgs` too and calls `silenceMissingWithArgsFeatureError` an escape hatch; the query skill recommends `withArgs` for mutations.
