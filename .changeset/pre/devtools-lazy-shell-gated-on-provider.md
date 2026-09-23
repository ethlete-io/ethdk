---
'@ethlete/query': minor
'@ethlete/query-devtools': patch
---

`<et-query-devtools-lazy>` renders nothing without `provideQueryDevtools()` - no floating button, no
shortcut, no panel download - and the now-public `isQueryDevtoolsEnabled()` is what it gates on.
