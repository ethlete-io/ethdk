---
'@ethlete/cli': patch
---

`sketch ready` ends the `portAfterMerge` mark of a sketch whose agent fixed it after a merge, as `sketch rebase`
already did, so the mark no longer outlives a port that only had to fix the re-check.
