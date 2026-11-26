---
'@ethlete/agent-rules': patch
---

`ethlete-agents` commands run from a subdirectory now use the nearest directory holding `ethlete-agents.config.json` as the repo root, so `check` no longer reports false drift there.
