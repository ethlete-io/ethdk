---
'@ethlete/query': patch
---

A migrated query writes its response to the entity store before `onSuccess` and `state$` subscribers see the success.
