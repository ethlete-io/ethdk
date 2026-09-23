---
'@ethlete/query': patch
---

Legacy `QueryForm`: a value arriving through a navigation (back/forward, a link) now commits at once instead of waiting out the field's debounce, matching `defineQueryForm`.
