---
'@ethlete/agent-rules': patch
---

`sync` keeps the existing order of hook events and entries in `.claude/settings.json` and only updates, appends or removes its own entries, so a second run is a no-op.
