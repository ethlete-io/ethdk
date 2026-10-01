---
'@ethlete/query': patch
---

Mark an unused entry waiting out `keepUnusedFor` stale on an invalidation, so an `allowCache` execution refetches it instead of serving pre-mutation data.
