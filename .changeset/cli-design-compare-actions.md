---
'@ethlete/cli': patch
---

`design compare` on one part also runs the action check that `design task --verify` runs and fails on a miss. When the check cannot run it fails with `actions not checked: <reason>` instead of passing.
