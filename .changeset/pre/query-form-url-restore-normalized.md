---
'@ethlete/query': patch
---

Query forms: restoring an empty or unparseable URL value no longer counts as a change, so `?search=&page=3` keeps page 3 instead of resetting it.
