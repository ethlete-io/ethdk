---
'@ethlete/query': patch
---

Query: the `ET800` circular-dependency guard only counts executions with identical args, so a fast-typed search or a slider bound to `withArgs` no longer trips it.
