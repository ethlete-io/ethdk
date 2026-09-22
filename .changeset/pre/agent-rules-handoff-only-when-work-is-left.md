---
'@ethlete/agent-rules': patch
---

A handoff is now written only when work is actually left: the `handoff` skill tests for it first, and the `context-warning` hook's auto-mode escalation no longer forces a file.
