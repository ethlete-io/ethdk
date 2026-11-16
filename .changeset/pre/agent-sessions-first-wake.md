---
'@ethlete/agent-rules': patch
---

The agent-sessions dispatcher no longer types messages from before it started, even ones addressed to the woken agent; `inbox` still lists them.
