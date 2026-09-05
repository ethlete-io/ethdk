---
'@ethlete/query': patch
---

`querySequence`: every link of a chain reports the fully-built `total`, so `progress()` read from a link you kept a reference to can no longer climb past 100%.
