---
'@ethlete/query': minor
---

Auth: `withPersistentAuth`'s `autoLogin` takes a `shouldAutoLogin(url)` predicate alongside `excludeRoutes`, so route policy can be an exact match rather than a prefix.
