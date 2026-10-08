---
'@ethlete/query': patch
---

Freshness: a `cacheAdapter` answering `NaN` no longer keeps the response fresh forever; it counts as no freshness window, like `null`.
