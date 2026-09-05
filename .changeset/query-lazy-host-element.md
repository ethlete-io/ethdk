---
'@ethlete/query': patch
---

Query: resolve a query's host element only when the devtools ask for it, so a query no longer does a DI lookup and holds a DOM reference with the devtools off.
