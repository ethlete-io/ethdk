---
'@ethlete/query': patch
---

`executeUntilSettled` now settles when the execution is cancelled or its scope is destroyed, so a submitted form no longer stays stuck in `submitting()` after a logout, an evicted entry or a torn-down component.
