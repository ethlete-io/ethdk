---
'@ethlete/query': patch
---

Legacy query client: calling `setAuthProvider` again with the provider already set no longer cancels its scheduled token refresh.
