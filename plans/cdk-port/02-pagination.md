# 02 — Pagination

**Status: Phases 1 & 2 shipped 2026-07-24.** `libs/components/src/lib/pagination/` —
pure `paginate()` (ellipsis, no globals), headless `etPagination` (page model,
`totalPages`, sibling/boundary window, `items()`, `goTo`/`first`/`previous`/`next`/
`last`), themed default `et-pagination`, `PAGINATION_IMPORTS`, stories, specs, docs,
changeset.

**Phase 2 — polish, DONE.** (1) Items now render with the shared **`[et-button]`**:
current page = `filled` variant, others = `transparent` + `mutedUntilPressed` (stay
neutral until active); compact/square via `--et-button-*` token overrides (no
`!important`). (2) **Links mode** (`renderAs:'links'` + `urlForPage`) renders real
`<a href>`s; plain clicks intercepted, modified clicks pass through. **Paged SEO** is
an opt-in `etPaginationSeo` directive (own file/export, NOT in `PAGINATION_IMPORTS`,
so the base paginator tree-shakes clean) — per-page canonical + `rel="prev"`/`"next"`
+ optional `pageTitle`. ⚠️ It uses `applyLinkBinding`/`applyHeadTitleBinding`
**directly**, NOT `applyCanonicalBinding`/`applyPrevBinding`/`applyNextBinding`:
those go through `createPropertyBinding`, which reads its input `untracked`
(`libs/core/src/lib/seo/head-binding.ts:49`) and so **freezes the value at first
eval** — non-reactive, unusable with a changing `page` signal. (Left core as-is; a
core fix would be a separate, wider change.) (3) **Query-form binding** is already a
one-liner (`page` is a two-way `model`, `(pageChange)` exposed) — documented for
`tableRowsFromQuery`, signals `QueryForm`, and reactive-forms `QueryForm`; no new
code. (4) Extras shipped: "Showing X–Y of Z" readout (`totalItems`+`pageSize`),
`showJumpTo` field. Keyboard nav is native per-item tab stops (no roving tabindex —
that's the standard, more accessible pattern for a link/button list).

Original research (2026-07-23) against `libs/cdk/src/lib/components/pagination/`
(~730 lines incl. stories/docs). Net-new in `libs/components`
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
