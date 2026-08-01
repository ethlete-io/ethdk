---
'@ethlete/query': major
---

Query client: multi-tab sync and persistence are now opt-in `features` instead of on by default — the
`multiTabSync` / `persistence` options are gone, replaced by `features: [withMultiTabSync(), withQueryPersistence()]`.
A client without them ships neither engine. Migrate with `nx g @ethlete/query:migrate-query-client-features`.
