---
'@ethlete/query': patch
---

The `migrate-to-query-v3` generator maps the v2 `responseAdapter` result `{ token, refreshToken }` to `{ accessToken, refreshToken }` in `extractTokens`, and writes `defaultRememberMe: true` so the login cookie stays as long as in v2.
