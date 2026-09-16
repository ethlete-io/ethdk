---
'@ethlete/agent-rules': minor
---

The `context-warning` hook now reaches the agent at session start, between its own tool
batches and as a turn ends, not only when the user sends a message.
