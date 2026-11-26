---
'@ethlete/query': patch
---

Auth: `onRefreshFailure` and the `logout()` it triggers now run outside the reactive context of the effect that detects the failure. A consumer reacting to the session ending could otherwise throw `NG0602` instead of handling the logout.
