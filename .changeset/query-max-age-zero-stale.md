---
'@ethlete/query': patch
---

Caching: a response with `cache-control: max-age=0` is stale the moment it arrives, so an `allowCache` execute in the same tick re-fetches instead of serving it.
