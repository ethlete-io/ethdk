---
'@ethlete/agent-rules': patch
---

`agent-sessions run` and `restart` no longer refuse a command that sets CLAUDE_CONFIG_DIR when the caller is a human shell (no CLAUDECODE, no CLAUDE_CONFIG_DIR), so `claude2` starts from a plain terminal.
