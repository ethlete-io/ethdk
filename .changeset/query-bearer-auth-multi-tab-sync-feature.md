---
'@ethlete/query': major
---

Bearer auth multi-tab sync and leader election are opt-in: `createBearerAuthProvider`'s `multiTabSync`
option is replaced by `withBearerAuthMultiTabSync()` in `features` (~1.4 kB gz off the secure entry
without it), read back as `provider.features.multiTabSync.isLeader()`. Election runs on the Web Locks
API now rather than a `localStorage` heartbeat, so a tab that closes or crashes hands over at once.
`setupAuthTest()` lost its `multiTabSync` option. Migrate with
`npx nx g @ethlete/query:migrate-query-opt-in-features`.
