---
'@ethlete/query': patch
---

Auth: a 401 from a request sent with an already-replaced access token no longer triggers another token refresh - with rotating refresh tokens this looped refreshes indefinitely; the query now just retries with the current token.
