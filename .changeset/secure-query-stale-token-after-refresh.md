---
'@ethlete/query': patch
---

Secure queries now send the current access token after a token refresh instead of the one they were first built with, which used to `401` and could loop refresh-and-retry forever.
