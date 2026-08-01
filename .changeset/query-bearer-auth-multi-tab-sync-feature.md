---
'@ethlete/query': major
---

Bearer auth multi-tab sync and leader election are opt-in: the `multiTabSync` option on
`createBearerAuthProvider` is gone, replaced by the `withBearerAuthMultiTabSync()` feature in the
provider's `features` array. A single-tab app, a kiosk or an embedded webview now ships neither the
`BroadcastChannel` sync nor the Web Locks election - ~1.4 kB gz off the secure entry.

```ts
createBearerAuthProvider({
  name: 'my-auth',
  queryClientRef: MY_CLIENT,
  queries: [loginQuery, refreshQuery],
  features: [withBearerAuthMultiTabSync({ channelName: 'my-auth-sync' })],
});
```

Without the feature every tab is its own leader, so proactive token refresh runs per tab. The
elected leader is exposed as `provider.features.multiTabSync.isLeader()` / `.instanceCount()`.

`setupAuthTest()` in `@ethlete/query/testing` lost its `multiTabSync` option for the same reason -
pass `withBearerAuthMultiTabSync()` in `features` instead.

**Migration:** `npx nx g @ethlete/query:migrate-query-opt-in-features` converts every
`multiTabSync` option into the feature (and `--reportOnly` lists the call sites without touching
them).
