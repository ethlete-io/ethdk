---
'@ethlete/query': patch
'@ethlete/query-devtools': patch
---

The devtools session vault no longer uses `localStorage` outside a development build, so a deployed
app can mount the panel without leaving tokens and credentials behind.
