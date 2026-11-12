---
'@ethlete/cli': patch
---

A stale lib rebuild now runs `nx build` in the Nx workspace that owns the lib build folder, so a checkout that links its `libs` and `dist` from another checkout no longer refuses with "Cannot find project".
