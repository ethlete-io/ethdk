---
'@ethlete/query': patch
---

`fetchNextPage()` on a paged stack returns `null` and keeps its position when its args repeat an already loaded page, like `fetchPreviousPage()` does.
