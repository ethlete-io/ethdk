---
'@ethlete/query': patch
---

Stack, paged-stack and auth `execute()` calls, `createSnapshot()` and `asObservable({ injector })` now work inside an effect or computed, `queryComputedTillTruthy` stops after its first query, and creating a query there throws `ET001`.
