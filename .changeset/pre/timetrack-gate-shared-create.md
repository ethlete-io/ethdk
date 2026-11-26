---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

A Jira create approved while a paired machine is reachable waits for one queue exchange with that machine, so two machines approving the same create file one issue. Until then the agent reads it as still queued.
