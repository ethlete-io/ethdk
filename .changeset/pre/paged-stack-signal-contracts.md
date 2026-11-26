---
'@ethlete/query': patch
---

Paged query stack: `canFetchNextPage` / `canFetchPreviousPage` are now false while a page is loading, and `isFirstPageLoaded` reports whether page 1 is loaded instead of always being true.
