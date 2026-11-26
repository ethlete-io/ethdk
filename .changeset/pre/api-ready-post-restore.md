---
'@ethlete/cli': patch
---

`et api ready` runs a profile's new `postRestore` steps, seeds or exec entries such as a search reindex, after every snapshot restore, and fails naming the step and exit code when one fails.
