---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

An agent session in a worktree that lives inside another checkout's directory keeps the branch it reports, rather than taking the branch the enclosing checkout last switched to, so its time no longer goes to that branch's issue.
