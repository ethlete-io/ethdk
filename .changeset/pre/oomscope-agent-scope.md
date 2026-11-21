---
'@ethlete/agent-rules': patch
---

On Linux, `agent-sessions` starts the agent in its own systemd user scope that systemd-oomd avoids, so a heavy job is killed before the agent.
