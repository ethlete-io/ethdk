---
'@ethlete/agent-rules': patch
---

`agent-sessions run` starts `<name>-2`, `<name>-3` and so on when the session already has a terminal attached, so a second `claude` terminal gets its own agent.
