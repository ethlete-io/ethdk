---
'@ethlete/query': minor
---

Auth: `withTokenExpirationWarning` reads the expiry claim named by its new `expiresInPropertyName` option, so a token that carries the expiry under another name no longer reports no expiry at all.
