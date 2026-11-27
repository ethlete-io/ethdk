---
'@ethlete/cli': patch
---

The design server keeps running when a watched file is not readable yet (still being copied) or already gone; the next watcher event redraws it.
