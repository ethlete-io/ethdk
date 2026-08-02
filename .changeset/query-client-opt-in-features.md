---
'@ethlete/query': major
'@ethlete/components': patch
---

Query client: multi-tab sync and response persistence are opt-in `features` instead of defaults - the
`multiTabSync` / `persistence` client options are gone and a client without the features ships neither
engine. Migrate with `nx g @ethlete/query:migrate-query-client-features`.

- `withMultiTabSync()` shares reads, polls a cache key in one tab for all of them and refreshes the
  others after a mutation; per-query `multiTabSync: false` keeps a query tab-local.
- `withQueryPersistence()` keeps public reads in IndexedDB, so a reload renders the last known data
  while it revalidates. Secure responses need an explicit opt-in and are removed on logout.
- `refreshQueriesInUse()` also refreshes GraphQL queries transported over POST; devtools gain Sync
  and Disk columns.
