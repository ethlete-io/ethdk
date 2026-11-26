---
'@ethlete/agent-rules': patch
---

The agent-sessions skill starts each agent with `CLAUDE_CODE_TMPDIR=~/.cache/claude-tmp`, in `run`, the shell functions and `restart --process`, so a full `/tmp` does not stop the agent's shell.
