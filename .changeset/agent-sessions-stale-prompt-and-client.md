---
'@ethlete/agent-rules': patch
---

`agent-sessions restart --process` no longer passes a stored prompt twice, and `run` switches only the client of the calling tmux session.
