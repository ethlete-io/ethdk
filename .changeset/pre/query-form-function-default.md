---
'@ethlete/query': patch
---

A deprecated `QueryForm` field with a function `defaultValue` treats a value equal to its result as the default again, so it is neither written to the URL nor counted in `activeFilterCount$`.
