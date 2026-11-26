---
'@ethlete/cli': patch
---

`cli:compile` no longer deletes its output directory on start, so a second compile running at the same time cannot leave a partial build in the Nx cache.
