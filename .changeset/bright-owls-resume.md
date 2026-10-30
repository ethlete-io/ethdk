---
'@ethlete/agent-rules': minor
---

Add `ethlete-agents mailbox restart` and a clear-and-resume section to the `handoff` skill: inside a `tmux` session an agent can clear itself and resume from its handoff file, after it checks that no sub-agent, background command or open answer remains.
