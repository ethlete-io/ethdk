---
'@ethlete/query': minor
---

Error normalization: reduce an HTML error page (a proxy's `502`, a maintenance page) to its heading and message text instead of using the raw markup as the message. Exposes `isHtmlErrorPayload`, `htmlErrorPayload` and `extractHtmlErrorMessage`.
