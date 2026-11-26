---
'@ethlete/cdk': patch
---

`createFormChangesTracker().hasChanges` no longer reports the inverse, and both it and `createNavigationDismissChecker` now see a change to `''`, `0` or `false`.
