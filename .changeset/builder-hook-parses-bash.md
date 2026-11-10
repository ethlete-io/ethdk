---
'@ethlete/agent-rules': patch
---

The builder Stop hook now parses each Bash command into its simple commands. A heredoc body or a quoted string that names `agent-sessions.mjs send` or `git commit` no longer counts as a report or a commit.
