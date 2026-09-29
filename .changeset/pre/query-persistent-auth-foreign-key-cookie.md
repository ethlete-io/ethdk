---
'@ethlete/query': patch
---

Auth: `withPersistentAuth` no longer sends a garbled token, or deletes the shared cookie, when a sibling subdomain finds a remember-me cookie another origin wrote under `cookie.domain`.
