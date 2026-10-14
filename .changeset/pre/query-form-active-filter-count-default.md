---
'@ethlete/query': patch
---

Fix a query form's `activeFilterCount` staying stale when a function `defaultValue` re-resolves to the value already committed.
