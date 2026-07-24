---
'@ethlete/components': minor
---

Add a **Pagination** component (`et-pagination`, `PAGINATION_IMPORTS`). Bind a
two-way `page` and `totalPages`; it renders first/previous/next/last jump controls
around a window of page numbers, collapsing far pages behind `…` ellipses for large
counts (`siblingCount` / `boundaryCount` tune the window). Signals-first with a
headless tier — the `etPagination` directive owns the `page` model and exposes
`items()` + `goTo`/`first`/`previous`/`next`/`last`, and the pure `paginate()`
function builds the item list on its own. Items render with the shared `[et-button]`
(variants, focus rings, theming), so the current page is a `filled` button and the
rest stay neutral until active. Themed via surface/color tokens, full keyboard/ARIA
(`nav` landmark, `aria-current`, per-control labels), and pairs with the table's
`tableRowsFromQuery` adapter for server-side paging.

Extras: `renderAs="links"` + `urlForPage` render crawlable `<a href>`s (plain
clicks intercepted, modified clicks pass through); an opt-in `etPaginationSeo`
directive adds a per-page canonical plus `rel="prev"`/`rel="next"` (built on the
core head-binding utils, SSR-safe, tree-shakes when unused); a "Showing X–Y of Z"
readout via `totalItems`/`pageSize`; and a `showJumpTo` jump-to-page field.
