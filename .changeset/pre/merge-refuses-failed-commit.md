---
'@ethlete/cli': patch
---

`et design sketch merge` and the Studio merge now undo the merge and fail with git's reason when git refuses the merge commit, instead of leaving `merged.json` and the deleted sketch uncommitted.
