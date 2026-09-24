---
'@ethlete/agent-rules': patch
'@ethlete/timetrack': patch
'timetrack-app': patch
---

`ethlete-agents timetrack resync [path]` asks the app to read a checkout's agent session logs again,
so sessions it dropped before the checkout had a project link are stored.
