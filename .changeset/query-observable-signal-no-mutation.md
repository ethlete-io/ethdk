---
'@ethlete/query': patch
---

Queries: signals exposed as `ObservableSignal` are no longer mutated in place, so a query and its snapshots keep separate `id` signals and repeated `asObservable({ injector })` calls reuse one stream.
