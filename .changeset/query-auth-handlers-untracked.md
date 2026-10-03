---
'@ethlete/query': patch
---

Fix bearer auth event handlers that end the session or create a query throwing NG0602. The handlers now run untracked. The query devtools also skip an invalid stored account, and the provider that registers no longer fails.
