---
'@ethlete/cli': patch
---

`design ready` now records a committed direct edit in the tracked `merged.json` even when the stamp cache already holds its hash, and `READY UNCOMMITTED` points at `design ready` when the cache holds the new mark.
