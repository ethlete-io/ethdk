---
'@ethlete/query': minor
---

`createAuthGuard` gets `redirectOnSessionStart`, which sends a visitor on the login route to the return URL once a session starts there, such as a restore that lands after the guard timed out.
