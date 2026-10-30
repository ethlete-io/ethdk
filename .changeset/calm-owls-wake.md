---
'@ethlete/agent-rules': patch
---

The mailbox `dispatch` waits a short grace period and checks the inbox again before it wakes an agent, so an agent that reads with `inbox --wait` gets no stale wake-up line.
