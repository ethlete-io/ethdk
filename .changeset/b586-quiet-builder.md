---
'@ethlete/agent-rules': minor
---

The `context-warning` hook warns once per tier and no longer repeats a reminder on every later prompt. A session
started with the builder role gets `CLAUDE_CODE_SILENT_TURN_REMINDER=0`, so Claude Code's silent-turn reminder stays off
for it and its subagents.
