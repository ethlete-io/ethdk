---
'@ethlete/agent-rules': patch
---

The agent-sessions dispatcher no longer types into a tmux session of another checkout, and `send --to` refuses an agent that has no session in this checkout.
