---
'@ethlete/agent-rules': minor
---

The `subagent-model-policy` hook no longer denies a subagent call that names no model: it runs it on `sonnet` and
returns the model table as a note. The delegating rule now says sonnet is the default.
