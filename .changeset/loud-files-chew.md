---
'@ethlete/core': patch
---

Fail silently inside `syncSignal` if the initial read fails. This will log a warning in dev mode. Set `skipSyncRead` to `true` to skip the initial read.
