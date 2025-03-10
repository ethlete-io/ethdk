---
'@ethlete/query': patch
---

Fix race condition during query execution where the args would not yet represent the current state since an effect was still pending
