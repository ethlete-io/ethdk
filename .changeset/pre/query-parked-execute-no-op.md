---
'@ethlete/query': patch
---

A bare `execute()` on a query whose `withArgs` source returns `null` now does nothing and warns in dev mode, instead of a request with `null` args.
