---
'@ethlete/timetrack': patch
'@ethlete/agent-rules': patch
---

`status` and `ethlete-agents timetrack status` report `tempoReady`. Without a Tempo token the app reads no worklog history, and nothing said so.
