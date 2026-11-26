---
'@ethlete/agent-rules': patch
---

Fix `agent-sessions restart --process`: a command a login shell wraps (`zsh -lic '...'`) is rewritten inside the wrapper and keeps the prompt inside it, and the new process takes the role of the target session, not a stale one.
