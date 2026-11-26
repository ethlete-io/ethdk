---
'@ethlete/agent-rules': patch
---

The builder Stop hook also blocks a stop one time when the turn ran `git commit` or `git push` and sent no report with `SendMessage` or `agent-sessions send`.
