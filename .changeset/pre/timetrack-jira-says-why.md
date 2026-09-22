---
'@ethlete/timetrack': patch
---

A rejected Jira call now reports what Jira said. `errorMessages` and the field names in `errors` are
read off the response body, so a 400 on a create names the field instead of only the status.
