# 02 — Pagination

**Status: planned, not started.** Size: M. Research done 2026-07-23 against
`libs/cdk/src/lib/components/pagination/` (~730 lines incl. stories/docs).
Net-new in `libs/components` — nothing pagination-shaped exists there
(`selectOptionsFromQuery` is load-more, not a numbered paginator).

## What cdk ships today (keep / fix / drop)

- **Page binding via `FormControl<number|null>`** (`pageControl` accessor
  `@Input`; no outputs — parents observe the control). **Drop**: signals-first
  rewrite uses `page` as a `model<number>()` (two-way) — plays with both plain
  signals and the future signal QueryForm (`00-query-form-signal-forms.md`).
- **`paginate()` pure util** computes `PaginationItem[]` (first/prev/next/last
  hot links + a window of `pagesBeforeAfter` (default 2) pages around current,
  window shifts at edges). **Keep the pure-function approach**, but:
  - **Fix: it builds URLs from `window.location.href` directly** —
    SSR/test-hostile. The rewrite must not touch globals: item URLs (when link
    mode is used) come from Angular `Router.createUrlTree` or a
    consumer-provided `urlForPage: (page) => string | UrlTree`.
  - **New: ellipsis/truncation.** cdk never collapses far pages behind `…`
    (`page-number-far` is just a CSS hook). The rewrite should emit explicit
    `ellipsis` items for large page counts (standard `1 … 45 46 47 … 200`
    shape) — this is the main functional upgrade.
- **`renderAs: 'links' | 'buttons'`** — keep the concept: links (real `href`,
  router-driven, SEO-crawlable) vs buttons (pure state). With links, clicks
  still route through the component (no full navigation), matching cdk's
  `PaginationLinkDirective` interception.
- **SEO head service** (`document.title` template with `%s`, first-page title,
  canonical `<link>` via Router). **Keep but isolate**: a separate opt-in
  directive/service (own secondary import) so the base paginator tree-shakes
  clean without it. It's genuinely used (docs show it) — don't drop.
- **`pageChangeScrollAnchor`** (scroll element into view on page change) —
  keep, trivial.
- **a11y** — keep all of it: `nav[aria-label]`, `aria-current="page"`,
  per-item labels ("Page N", "Previous page", …), disabled semantics
  (`aria-disabled` on links, `disabled` on buttons).

## New design

Follow `component-architecture` (three tiers):

- **Headless**: `etPagination` directive owning state (`page` model,
  `totalPages` input, `pagesBeforeAfter`, ellipsis config) and exposing
  `items: Signal<PaginationItem[]>`; `etPaginationItem`-style directive for
  item wiring (click/keyboard/ARIA). `paginate()` stays an exported pure
  function (typed `PaginationItem` with `type: 'page' | 'ellipsis' |
'first' | 'previous' | 'next' | 'last'`).
- **Default component**: `et-pagination` — and unlike cdk (which shipped an
  **empty** stylesheet, all visuals consumer-provided), ship real themed
  default styling: `@layer components`, surface/color tokens per the `theming`
  skill, `:where()` for config modifiers, focus-visible states. Story CSS in
  cdk (`::before` arrow glyphs etc.) shows what consumers had to hand-roll —
  that becomes the default look (with proper icons from the `icon` domain, not
  `content` glyphs).
- **Query integration**: tiny helpers to derive `totalPages`/`page` from the
  standard list envelope (`{ totalHits, currentPage, totalPageCount,
itemsPerPage }` — see the list-view reference in `01-table.md`) and from
  `Paginated<T>` in `@ethlete/types`. Pairs with `01-table.md`'s
  `tableRowsFromQuery` (its `setPage` hook + pagination info signals should
  bind 1:1 to this component).
- **QueryForm interop**: binding the paginator's `page` model to a query-form
  `page` field must be a one-liner; document it (both the current
  reactive-forms QueryForm via its control, and the signals variant once
  `00` lands).

## Deliverables

Component + headless directives, stories (default, ellipsis/large page count,
buttons vs links, query-integration demo), docs page
(`apps/docs/components/pagination.md`) incl. SEO head usage, changeset
(`@ethlete/components` minor). cdk pagination stays untouched (maintenance).
