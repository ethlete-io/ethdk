---
'@ethlete/components': patch
---

`paginate` and `etPagination` now round a fractional current page down and treat a non-numeric one as page 1, so a page always carries `current` and previous/next point at real pages. Fractional or negative `siblingCount`/`boundaryCount` are rounded down to a whole count of at least 0, and a non-numeric one falls back to the default, instead of producing page numbers like `3.5`.
