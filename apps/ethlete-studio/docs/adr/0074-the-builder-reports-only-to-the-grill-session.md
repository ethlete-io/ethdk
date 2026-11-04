---
status: accepted
open: none
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206), Q225
---

# The builder reports only to the grill session

The builder writes nothing for Tom in its chat (one closing line at most); every report goes to the grill session by
`SendMessage`. It stays a tmux session, not a subagent. The rule is in the `builder-agent` skill.
