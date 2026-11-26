---
'@ethlete/agent-rules': patch
---

`agent-sessions stop-own` stops only the calling subagent's own processes: the `background-design-commands` hook stamps every subagent Bash call with `ET_AGENT_ID`, and sibling subagents' runs are no longer selected.
