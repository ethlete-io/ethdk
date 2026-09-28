---
'@ethlete/components': patch
---

Select: `[etSelectOptions]` follows a swapped bundle, so `loading`, `error` and `hasMore` read the bundle that `setQuery` and `loadMore` now go to.
