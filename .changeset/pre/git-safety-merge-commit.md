---
'@ethlete/agent-rules': patch
---

The git-safety hook now allows a pathless `git commit` that concludes a merge, no longer denies commands that only mention `git commit` in a grep pattern or heredoc, and drops the obsolete `go.json` rule.
