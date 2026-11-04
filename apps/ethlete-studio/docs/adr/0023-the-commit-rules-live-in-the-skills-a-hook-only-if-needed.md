---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Commit volume decisions" item 4
---

# The commit rules live in the skills; a hook only if needed

The rules live in the `git-commit` skill (source in `libs/agent-rules/content/skills/git-commit/`) and the
`builder-agent` and `doc-agent` skills. A commit-rate hook follows only if the count does not drop clearly within a
week (check on 2026-11-11).
