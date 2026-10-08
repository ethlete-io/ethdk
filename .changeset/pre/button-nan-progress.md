---
'@ethlete/components': patch
---

A button's loading spinner stays indeterminate when its `progress` (or an `etQueryButton` query's progress, e.g. from an empty transfer) is not a finite number, instead of showing a stuck 0%.
