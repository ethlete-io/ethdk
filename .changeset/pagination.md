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
readout via `totalItems`/`pageSize`; and a `showJumpTo` jump-to-page field. The
paginator is `responsive` by default — it adapts to its own measured width (not a
viewport media query), trimming the page window to fit one row and, when space is
tight, collapsing to a compact pager: a range readout ("1–10 of 40" from
`totalItems`/`pageSize`, else the page position) followed by previous/next, ordered
so the chevrons hold their place as the digit count changes. `[compact]="true"`
forces that pager for an inline Material-style controls row; `size="sm"` shrinks the
number-row items.

Page and control cells are now actually square: the shared button's own
`[data-size='sm']` padding rule out-specified the paginator's `--et-button-padding`
override, which left every chevron 40×34. The geometry is now set from a host-scoped
rule, and icon-only controls (first/previous/next/last) take a fixed inline size, so
each cell matches `--et-pagination-item-size` exactly while page numbers still grow for
3+ digits.

The paginator's metrics (item size, gaps, text sizes) are px rather than root-relative
`rem` — identical at a 16px root, but no longer shrunken in apps that set a smaller
one (e.g. the `62.5%` trick).

Every string the paginator renders is localizable: `providePaginationLabels({ … })`
overrides the English defaults app-wide (partial — omitted keys keep their default),
and a `labels` input overrides the provided set for one instance. Covers the control
`aria-label`s, the `page` label, the range/compact readouts and the jump-to label;
`paginate()` accepts the same overrides as a `labels` option. `ariaLabel` now defaults
to `null` and falls back to the label set's `navigation` string — set it only to
distinguish paginators on one page.
