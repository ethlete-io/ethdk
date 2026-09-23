---
'@ethlete/query': patch
---

Testing entry point: `setupQueryTest` now installs one console filter instead of nesting a
new one per call, and exposes `restoreConsole`. `installFakeWebLocks` removes the `abort`
listeners it adds. The websocket double reports `withCredentials()`.
