---
'@ethlete/query': minor
---

Query devtools: add `provideQueryDevtools()` and a registry that instruments
queries, query stacks, paged query stacks, `querySequence`, bearer auth providers
and web socket clients so they can be inspected by `<et-query-devtools>` (from
`@ethlete/components`). Instrumentation is a no-op unless the provider is added,
so there is no overhead when it is omitted.

Supporting devtools APIs added: `querySequence` exposes a `stepArgs` signal (the
resolved input args of each step); the query repository gains
`subtle.cacheEntries()` / `subtle.cacheVersion` / `subtle.evict()`; queries gain
`subtle.setLoading()` / `subtle.setError()` (force UI states for testing);
`HttpRequest` exposes `method`, `url` and `expiresAt`; `QueryClient` exposes its
`baseUrl`; `QuerySequence` exposes its step `queries`; and web socket clients
expose a devtools handle (connection state, rooms, recent messages).
