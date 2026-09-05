---
'@ethlete/query': patch
---

Legacy query client: `setAuthProvider` no longer deletes the refresh cookie of the provider it replaces, so a reload right after a runtime re-configuration keeps the session. `clearAuthProvider` still ends it.
