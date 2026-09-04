---
'@ethlete/query': patch
---

Query persistence: a response written before the store index finished loading is no longer dropped by the startup pruning of a bumped `version`.
