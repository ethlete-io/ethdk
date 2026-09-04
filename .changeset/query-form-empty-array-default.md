---
'@ethlete/query': patch
---

`defineQueryForm`: an emptied array field commits as its `null` default, so it is not counted as a filter and leaves the URL clean.
