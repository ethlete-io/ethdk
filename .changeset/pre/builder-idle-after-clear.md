---
'@ethlete/agent-rules': patch
---

The `builder-idle-check` hook now counts agents that were started before a `/clear` and still run, read from the unfinished meta files in the session's `subagents/` directory.
