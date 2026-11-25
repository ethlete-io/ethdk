---
'@ethlete/agent-rules': patch
---

`agent-sessions restart` refuses a stored command that does not run `claude` or `codex` instead of starting a bare shell, and a footer with only "↓ to manage" no longer counts as background work.
