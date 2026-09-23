---
'@ethlete/timetrack': patch
---

The fake Jira backend now answers `createmeta`, so a spec can drive the guard that reads what an
account may create. `notCreatable` names the types it refuses, which stay in `/issuetype`.
