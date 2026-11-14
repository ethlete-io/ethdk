---
'@ethlete/cli': patch
---

Write `ready.json`, `merged.json` and `sketch.json` atomically (temp file and rename) under a per-product lock, so a serve and a CLI call can no longer lose each other's update or leave a torn file.
