---
'@ethlete/timetrack': patch
---

`createJiraIssue$` takes an `assigneeAccountId` and writes it to the issue's `assignee` field. Absent,
it files the issue unassigned, exactly as before.
