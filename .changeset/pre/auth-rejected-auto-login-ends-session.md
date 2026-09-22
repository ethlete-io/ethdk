---
'@ethlete/query': patch
---

Auth: a rejected cookie auto-login now ends the session through `onRefreshFailure` with `sessionEndCause()` `'expired'`, and `setTokens()` supersedes an auto-login still in flight so its late `401` no longer overwrites the seeded session.
