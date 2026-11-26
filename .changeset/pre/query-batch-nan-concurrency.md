---
'@ethlete/query': patch
---

`createQueryBatch`: a `concurrency` of `NaN` falls back to the default of 4 instead of leaving the run stuck forever.
