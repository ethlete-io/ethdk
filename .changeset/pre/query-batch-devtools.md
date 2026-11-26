---
'@ethlete/query': minor
---

A query batch registers itself with the devtools, and each item's query is attributed to the run that
created it. Batch tombstones are capped per batch, so a bulk run cannot evict the others.
