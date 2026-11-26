---
'@ethlete/agent-rules': patch
---

The context warning and the shell functions from `shell-install` also find the agent-sessions script under `.claude/skills`, so a session in such a repo starts in tmux and restarts itself after a handoff instead of asking the user to clear.
