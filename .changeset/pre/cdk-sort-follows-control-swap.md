---
'@ethlete/cdk': patch
---

Fix `etSort` ignoring a replaced `sortControl`, `sortByControl` or `sortDirectionControl`: it now watches the new control instead of the old one.
