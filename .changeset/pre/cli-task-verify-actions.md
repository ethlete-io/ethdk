---
'@ethlete/cli': patch
---

`design task --verify` now also runs the actions check and fails when an action misses or the check cannot run, so a part with a dead control is no longer recorded as implemented.
