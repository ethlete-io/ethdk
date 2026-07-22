---
'@ethlete/query': minor
---

Query devtools: add `provideQueryDevtools()` and a registry that instruments
queries, query stacks, paged query stacks, `querySequence` and bearer auth
providers so they can be inspected by `<et-query-devtools>` (from
`@ethlete/components`). Instrumentation is a no-op unless the provider is added,
so there is no overhead when it is omitted. The query repository also gains a
`subtle.cacheEntries()` / `subtle.cacheVersion` accessor for cache inspection, and
`querySequence` now exposes a `stepArgs` signal with the resolved input args of
each step.
