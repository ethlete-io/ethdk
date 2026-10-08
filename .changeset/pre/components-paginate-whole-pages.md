---
'@ethlete/components': patch
---

`paginate` and `etPagination` now keep the current page, `siblingCount` and `boundaryCount` whole, non-negative numbers, so no page number like `3.5` appears.
