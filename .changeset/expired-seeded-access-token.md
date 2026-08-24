---
'@ethlete/query': patch
---

A secure query now waits for the token refresh instead of sending an access token that is already expired, so a session seeded by SSO no longer costs a `401` and a retry.
