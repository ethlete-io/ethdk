---
'@ethlete/query': minor
---

Query devtools: add `provideQueryDevtools()` and a registry that instruments
queries, query stacks, paged query stacks, `querySequence` and bearer auth
providers so they can be inspected by `<et-query-devtools>` (from
`@ethlete/components`). Instrumentation is a no-op unless the provider is added,
so there is no overhead when it is omitted.

Supporting devtools APIs added: `querySequence` exposes a `stepArgs` signal (the
resolved input args of each step); the query repository gains
`subtle.cacheEntries()` / `subtle.cacheVersion` / `subtle.evict()`; queries gain
`subtle.setLoading()` / `subtle.setError()` (force UI states for testing); and
`HttpRequest` exposes `expiresAt` (cache freshness timestamp).
