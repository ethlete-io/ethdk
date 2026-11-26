---
'@ethlete/query': patch
'@ethlete/query-devtools': patch
---

The panel drops a client's Cache, Faults and Events entries once that client's injector is destroyed,
instead of keeping them alive for as long as one of its queries has a tombstone.
