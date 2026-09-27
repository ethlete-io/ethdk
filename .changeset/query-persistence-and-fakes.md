---
'@ethlete/query': patch
---

A response body that cannot be structured-cloned is now skipped with a dev warning instead of dropping its whole persistence batch and disabling writes; in `@ethlete/query/testing`, `installFakeBroadcastChannel` delivers as a task (await `flushMultiTabSync()`) and the fake persistence store's deferred `read` returns what it held when the read started.
