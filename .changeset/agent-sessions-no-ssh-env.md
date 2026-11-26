---
'@ethlete/agent-rules': patch
---

`agent-sessions run` and `restart` no longer pass `SSH_CONNECTION`, `SSH_CLIENT` and `SSH_TTY` to the agent they start in tmux, so Claude Code accepts a pasted image after a restart from an SSH client.
