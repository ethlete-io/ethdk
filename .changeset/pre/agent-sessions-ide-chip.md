---
'@ethlete/agent-rules': patch
---

`agent-sessions restart` no longer reads the Claude Code IDE context chip (`[⧉ In file]`) on the prompt line as a draft, so it types the resume prompt after the clear.
