---
'@ethlete/query': major
'@ethlete/components': patch
---

Query clients now coordinate with the user's other tabs **by default**: successful reads are shared,
a polled cache key is polled by one tab on behalf of all of them, and a mutation refreshes what the
other tabs have on screen. Set `multiTabSync: false` on the client (or per query) to keep tabs
independent. See [Multi-tab sync](https://ethlete-sdk-docs.web.app/query/multi-tab).

- `refreshQueriesInUse()` now also refreshes GraphQL queries transported over POST.
- The devtools Cache tab gains a Sync column showing the poll election and shared-response state.
