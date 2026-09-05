---
'@ethlete/query': patch
---

Legacy `QueryForm`: `value`, `changes$` and `activeFilterCount$` now track control writes on a form that never calls `observe()`, instead of staying stuck on the initial value.
