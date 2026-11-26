---
'@ethlete/query': patch
---

Secure queries executed after `setTokens()` (SSO/OIDC callbacks, native shells) no longer wait forever - they now also proceed once `executionState` reports a successful token seed.
