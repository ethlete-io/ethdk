---
'@ethlete/agent-rules': minor
---

The `builder-idle-check` hook blocks a builder stop while fewer agents run than the slot limit and a free Builder row
exists. The limit is `builderSlots` in `ethlete-agents.config.local.json` (default 4).
