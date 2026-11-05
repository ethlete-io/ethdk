---
'@ethlete/cli': patch
---

The sketch merge compare and the auto-merge count a pixel as changed only when a channel differs by more than 8 of 255, so anti-alias noise no longer blocks an auto-merge.
