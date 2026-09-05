---
'@ethlete/query': patch
---

Devtools: the tombstone a destroyed query leaves behind no longer keeps `queryConfig.injector`, which held the destroyed component's whole view in memory.
