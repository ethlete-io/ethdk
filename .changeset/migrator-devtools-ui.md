---
'@ethlete/query': patch
---

`migrate-to-query-v3` writes `provideQueryDevtools({ ui })` and removes the v2 devtools tag and component import. Without a legacy provider call it still switches to the lazy component.
