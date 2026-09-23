---
'@ethlete/query': patch
---

Query persistence: mutations are never stored, one opted-in consumer is enough, GraphQL over POST persists, a failed IndexedDB open is retried, and a purge always beats a hydration or index load in flight.
