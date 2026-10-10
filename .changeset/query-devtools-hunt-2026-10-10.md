---
'@ethlete/query-devtools': minor
---

Fix four panel bugs. A query parked by a `withArgs` source that returns `null` now shows as `parked` (status dot, detail and a new **Parked** chip), and **Execute** / **Cached** open the args editor with a hint instead of doing nothing. Closing the panel turns **Inspect** off, so app clicks are no longer swallowed. Opening the panel focuses its active tab, and closing it gives focus back to where it was (or to the floating toggle). When `<et-query-devtools-lazy>` fails to load the panel chunk, the toggle turns red and reloads the page on click. `QueryDevtoolsToggleComponent` gains a `loadFailed` input and a `focus()` method.
