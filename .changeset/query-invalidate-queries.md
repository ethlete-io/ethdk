---
'@ethlete/query': minor
---

New `client.invalidateQueries()` re-runs the queries this client has on screen whose data went stale - after a mutation, or a push message saying something changed server-side - **and tells the user's other tabs to do the same**. See [Invalidating after a change](https://ethlete-sdk-docs.web.app/query/caching#invalidating-after-a-change).

```ts
await createPlayer.execute({ body });

client.invalidateQueries({ url: '/players' }); // /players, /players/1, /players?page=2
client.invalidateQueries(); // everything on screen, here and in the other tabs
```

- `url` resolves against the client's `baseUrl` like a route, and matches on path boundaries: `/players` covers `/players/1`, but not `/players-archive`.
- `filter` narrows further on each query's built `{ method, url }`. It stays in the calling tab - a function cannot cross a `BroadcastChannel` - so the others invalidate by `url` alone; pair it with `otherTabs: false` when the two must agree.
- `otherTabs: false` keeps an invalidation local. Reaching the other tabs needs `multiTabSync` (on by default) and is not affected by `refreshOnMutation`, which only governs the client's own mutation heuristic.
- Same set as `refreshQueriesInUse()`: cacheable entries with at least one consumer, cache bypassed, in-flight requests restarted. Entries sitting out their `keepUnusedFor` window are left to revalidate when a consumer binds again.
