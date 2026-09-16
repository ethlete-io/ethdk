---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

The parent picker no longer offers a sub-task, which Jira accepts as a parent in no hierarchy.
`JiraIssue` now carries `isSubtask`, read from Jira's own flag on the issue type.
