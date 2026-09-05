---
'@ethlete/query': patch
---

Query persistence: a logout purge the store refuses no longer leaves the previous user's responses hydratable - they are forgotten at once and the removal is retried.
