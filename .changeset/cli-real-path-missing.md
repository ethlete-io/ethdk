---
'@ethlete/cli': patch
---

The design editor tsconfig now treats a missing CLI build folder under a symlinked temporary folder as transient, so a run from it no longer overwrites the tsconfig.
