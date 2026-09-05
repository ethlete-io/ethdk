---
'@ethlete/query': patch
---

Query: the `ET800` circular-dependency guard counts only executions with identical args and measures its window with its own clock, so a fast-typed search no longer trips it.
