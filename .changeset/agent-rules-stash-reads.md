---
'@ethlete/agent-rules': patch
---

Let `git stash list` and `git stash show` through the git-safety hook. Every writing stash subcommand stays refused, and the refusal names it.
