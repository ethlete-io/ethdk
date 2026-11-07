---
'@ethlete/agent-rules': patch
---

The `background-design-commands` hook matches long design commands only at command position, so a heredoc, an unquoted `echo` or a `git commit` message that names `design check` no longer gets denied.
