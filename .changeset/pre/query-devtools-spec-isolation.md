---
'@ethlete/query': patch
'@ethlete/query-devtools': none
---

Add the internal `ɵresetQueryDevtoolsForTesting()`, which undoes `provideQueryDevtools()` so a spec that shares a worker with another sees the devtools disabled again.
