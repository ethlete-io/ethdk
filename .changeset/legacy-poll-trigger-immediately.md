---
'@ethlete/query': patch
---

`poll({ triggerImmediately: true })` now runs at once, and the default first run lands after one interval instead of two - including the catch-up after the window regains focus.
