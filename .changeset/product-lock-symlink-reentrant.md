---
'@ethlete/cli': patch
---

Recognise a nested design-file lock as the same product when one caller names the product through a symlinked path, so a merge commit no longer waits 10 s on its own lock and then throws.
