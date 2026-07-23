---
'@ethlete/components': minor
---

Add a **Pagination** component (`et-pagination`, `PAGINATION_IMPORTS`). Bind a
two-way `page` and `totalPages`; it renders first/previous/next/last jump controls
around a window of page numbers, collapsing far pages behind `…` ellipses for large
counts (`siblingCount` / `boundaryCount` tune the window). Signals-first with a
headless tier — the `etPagination` directive owns the `page` model and exposes
`items()` + `goTo`/`first`/`previous`/`next`/`last`, and the pure `paginate()`
function builds the item list on its own. Themed via surface/color tokens, full
keyboard/ARIA (`nav` landmark, `aria-current`, per-control labels), and pairs with
the table's `tableRowsFromQuery` adapter for server-side paging.
