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

Calls are identified by base URL (not the internal client name); stacks and auth
providers surface identifying info (endpoint, features, queries, token-expiry
countdown); the Stacks and Sequences drawers each keep their own selection; and a
"Copy report" action puts a Slack-ready rich-text summary (path, args, status,
slimmed response, GraphQL document) on the clipboard.
