---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

Every Jira create, including the epic or parent create and the agent's `jira.create`, now skips an issue the project already holds and shares a create still in flight, so a retry files no duplicate.
