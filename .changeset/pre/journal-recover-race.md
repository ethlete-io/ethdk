---
'@ethlete/cli': patch
---

Fix a write-journal recovery that threw `ENOENT` when another thread of the same process closed its journal while the recovery read it
