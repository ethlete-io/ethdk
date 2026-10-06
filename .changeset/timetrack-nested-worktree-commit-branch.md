---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

A commit made in a worktree that lives inside another checkout's directory keeps its own branch when it is filed to the session that wrote its files, and it no longer moves the enclosing checkout's branch.
