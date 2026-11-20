---
'@ethlete/agent-rules': patch
---

The `status-line` mod shows its band only in a session that ran the `doc-agent` skill (typed `/doc-agent` or called by the model); `builder-agent` hides it again, and every other session never shows it nor polls git and CI for it.
