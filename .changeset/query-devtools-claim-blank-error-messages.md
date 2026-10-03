---
'@ethlete/query': patch
---

`queryErrorMessages` and `queryErrorMessage` drop blank messages and fall back to the raw response message, and the devtools token TTL override honors a custom `expiresInPropertyName`.
