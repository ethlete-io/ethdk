---
'@ethlete/query': patch
---

`fetchPreviousPage()` returns the query it created for the page it fetched, not the stack's last query, and returns `null` when it created none.
