---
'@ethlete/query': patch
---

A response that cannot be structured-cloned is now skipped with a dev warning instead of disabling persistence writes; in `@ethlete/query/testing`, the fake `BroadcastChannel` delivers as a task (await `flushMultiTabSync()`) and fake store reads are consistent.
