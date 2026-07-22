---
'@ethlete/components': minor
---

Add `<et-query-devtools>` (`QUERY_DEVTOOLS_IMPORTS`): a floating, dockable panel
that inspects the signals-first `@ethlete/query` system — queries, stacks,
sequences, GraphQL queries, bearer auth providers, web socket clients, the
repository cache and a rolling event log. Enable instrumentation with
`provideQueryDevtools()` from `@ethlete/query`.

Beyond a read-only view it can act on live queries: a searchable value explorer,
JIT editing (apply an edited response via `setResponse`, replay with edited
args), forcing loading / error / empty states, cache freshness countdowns with
refetch / evict, and an "inspect" mode that highlights the component behind a
query when you hover the live UI.
