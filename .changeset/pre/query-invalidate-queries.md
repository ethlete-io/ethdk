---
'@ethlete/query': minor
---

New `client.invalidateQueries()` re-runs the queries this client has on screen whose data went stale -
after a mutation, or a push message saying something changed server-side - and tells the user's other
tabs to do the same. Narrow it with `url` (resolved against `baseUrl`, matched on path boundaries) and
`filter`, or keep it local with `otherTabs: false`; reaching other tabs needs `withMultiTabSync()`.
See [Invalidating after a change](https://ethlete-sdk-docs.web.app/query/caching#invalidating-after-a-change).
