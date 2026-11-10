---
'@ethlete/agent-rules': patch
---

`agent-sessions restart --process` keeps the tmux session of the agent, does not send the first prompt of `run` again, and answers the background work dialog of Claude Code with "exit and stop tasks".
