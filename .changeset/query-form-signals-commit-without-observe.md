---
'@ethlete/query': patch
---

`defineQueryForm`: the committed `value` now follows control edits on a form that never calls `observe()`, and after `unobserve()`.
