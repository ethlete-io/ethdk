---
'@ethlete/query': patch
---

Auth fixes: `redirectOnSessionEnd` fires with `withTokenRevocation`, only the tab a logout started in revokes tokens, a logout during an in-flight revocation still revokes, and multi-tab sync is inert on the server.
