---
'@ethlete/cli': patch
---

Design commands that run at the same time no longer share one Vite cache folder: the first keeps the shared cache, every other one draws from a folder of its own that it removes when it closes.
