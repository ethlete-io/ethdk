---
'@ethlete/query': patch
---

`BearerAuthProvider.setTokens()` now sets `executionState` to `{ type: 'tokenSeed', state: 'success' }`, so SSO/OIDC callback and native-shell logins work with the same `executionState`-driven redirect logic as a query-driven login.
