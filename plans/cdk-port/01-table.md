# 01 — Table (new system, NOT a cdk port)

**Status: Phases 1 + 2 shipped (2026-07-23).** Size: XL — split into shippable
phases below. Phase 0 decisions recorded under _Markup strategy_; the table lives
in `libs/components/src/lib/table/`. Next up: Phase 3 (filter headers). Phase 2b
leftovers (legacy-client adapter twin + shared query-core extraction) noted below.

## Why green-field

The cdk table wraps `@angular/cdk` table, which has weak type safety (stringly
`matColumnDef`-style wiring, untyped cell contexts). We are **not porting it**.
We build a new table system in `libs/components` with these hard requirements:

1. **Type-safe end to end** — the row type `T` flows from data source through
   column defs into cell template contexts (via `ngTemplateContextGuard`).
   No string-matching column names against templates without compiler checks.
2. **Light by default, tree-shakable features** — the base table renders typed
   rows/cells and nothing else. Sort, filter menus, sticky, reordering, nesting,
   virtualization, state persistence are each **separate opt-in directives /
   secondary imports** so unused features drop out of the bundle.
3. **Easy to grasp** — small API surface per feature; ag-grid capability
   without ag-grid's config-object sprawl.
4. **First-class @ethlete/query integration** — loading/error/empty states from
   query signals, server-side sort/filter/pagination via QueryForm.

This plan **absorbs cdk `sort` and the filter-header part of cdk `filter`**
(sort headers and filter menus are table features here). `10-filter.md` shrinks
to investigating cdk `rich-filter` standalone use.

## Prior art in this repo (read before designing)

- **Virtualization**: `libs/components/src/lib/forms/select/headless/select.directive.ts`
  (`virtualizedItems()` — signal-computed window between block-padding spacers,
  estimated row heights with post-render alignment) and
  `select-virtual-option.directive.ts` (row adopts item while windowed-in:
  element attach/detach for measurement + ARIA). The table should **extract this
  windowing core into a shared headless utility** (likely
  `components/src/lib/internals` or `core`) and have both select and table
  consume it. That extraction is Phase 0 work and must not regress the select
  (it has specs — run them).
- **URL/state serialization**: `QueryForm` in `@ethlete/query`
  (`QueryField`, `SearchQueryField`, `SortQueryField`) already debounces,
  serializes to URL query params, and feeds query args — see
  `apps/docs/query/index.md`. **Caveat: QueryForm is reactive-forms-only today
  and documented as "primarily used with the legacy client". A signal-forms
  port of QueryForm is a prerequisite for the table's server-side integration —
  see `00-query-form-signal-forms.md`.** Phases 2/7 integrate against that
  ported API (or a thin adapter if the port isn't done yet).
- **Menus with search** (for filter headers): `components/src/lib/menu` +
  `forms/input` — compose, don't rebuild.
- **Architecture shape**: `component-architecture` skill (three tiers:
  headless directives + default styled components, error codes,
  self-registration). Reference implementations: `select`, `bracket`.

### Reference consumer: server-driven "list view" APIs

Our backends typically expose a list-view system the table must integrate with
**without hassle — but also without hard-committing to its schema** (it may
change). Reference: the Partnerships Hub OpenAPI doc
(`https://next-api-ea-hub.pique.braune-digital.com/doc`), whose shape
(as of 2026-07-23) is:

- **Saved named views per entity**: `/list-views` (overview), `/list-view`
  (create: name, view type, search query, isDefault, columns),
  `/list-view/{uuid}` (detail incl. `directUrl`), `/list-view/{view}/default`
  and set-default. I.e. users persist multiple named table setups server-side,
  one being the default.
- **Per-column config** (`ListViewColumnData`): `slug`, `hidden`,
  `valueSortOrder` (asc/desc/null — sort lives _on the column_), `hasFilter`,
  `filterValues: string[]`.
- **Server-defined column types** (`ListViewColumnType`): `text`,
  `image_text`, `badge`, `boolean`, `auto_increment` — the client renders
  columns _from config_, it doesn't know them statically.
- **Async filter options per column**: `/list-view/{uuid}/filter/{slug}`
  returns paginated, searchable options (`ListViewSearchView` envelope:
  `items`, `totalHits`, `currentPage`, `totalPageCount`, `itemsPerPage`).
- **Sub-table column configs** (`ListViewSubTableView`) — server-driven nested
  tables.
- List data endpoints share the envelope `{ items, totalHits, currentPage,
totalPageCount, itemsPerPage }` with `query`/`sortBy`/`sortOrder`/`page`/
  `limit` params.

Consequences for the design (folded into the sections below): the data-driven
column path is a **first-class requirement**, filter menus need **async
paginated + searchable options**, `TableState` must map cleanly onto
per-column config + named saved views, and sub-tables must be definable from
data. The SDK stays schema-agnostic: it ships the capabilities; the app maps
its list-view DTOs onto them (document that mapping as a docs recipe against
this reference API).

## Core design

### Markup strategy (Phase 0 spike — decide with a prototype)

Two candidates; prototype both against sticky header + sticky column +
virtualized rows before committing:

- **A. Native `<table>`**: best semantics/a11y for free; `position: sticky` on
  `th`/`td` works; virtualization needs spacer rows or tbody transforms, and
  column reordering means DOM moves per row.
- **B. CSS grid with `role="grid"`/`row`/`gridcell`**: one grid container,
  columns defined once (`grid-template-columns`), row order/column order are
  pure CSS concerns (`order`, template rearrangement), virtualization is the
  same block-padding pattern the select uses. Requires manual ARIA but we do
  that everywhere already.

Leaning **B** (grid) because reordering + virtualization + column sizing across
virtualized rows are structurally simpler, and the select precedent shows the
ARIA-manual approach works. But the spike decides; record the decision here.

#### Phase 0 decisions (recorded 2026-07-23)

Grounded in a source map of the select's virtualization + query adapters (not
yet a rendered Storybook spike — a lightweight sticky+virtual+reorder prototype
should still confirm before Phase 1 finalizes the markup).

- **Markup: B — CSS grid + `role="grid"`/`row`/`gridcell`.** Decider:
  `grid-template-columns` defines column widths once for the whole grid, so
  virtualizing rows (rendering only a window) never disturbs column alignment.
  Native `<table>` would need `table-layout: fixed` + explicit widths and spacer
  `<tr>`s to keep columns stable across a changing row window, and reordering
  means per-row DOM moves. Grid also lets the table reuse the select's existing
  single-scroll-container block-padding windowing model **directly**.
- **Virtualization core is ALREADY extracted** — `createVirtualWindow` in
  `libs/components/src/lib/internals/virtual-window.ts` (consumed by select
  today; decoupled, only dep is `signalElementDimensions` from core). The table
  calls it directly. **No select refactor needed for windowing.** Only the
  select's row-directive glue (ARIA + `attachVirtualOptionElement`/`measureItem`
  adopt-measure-detach) is select-specific; the table writes its own row
  directive over the same attach/measure/detach pattern.
- **Query-adapter core extraction** (the one production-touching refactor):
  `select-options-from-query.ts` (v1 signals client) and
  `select-options-from-v2-query.ts` (legacy client) duplicate, line-for-line,
  the shared machinery — debounced query, `minQueryLength` skip, page
  reset/advance (`linkedSignal` keyed on the debounced query), `pageSlices`
  accumulation + keepalive, error-message defaulting, return-object assembly.
  Extract that into a new package-private `internals/` helper parameterized by a
  small per-client "query driver" (`{ response/settled, loading, error }`
  signals); the two select factories become thin typed wrappers. Both
  `select-options-from-*query.spec.ts` are the regression gate and must stay
  green unchanged. **Sequencing note:** this only serves Phase 2 (query glue),
  not Phase 1 (core table) — it can be done in Phase 0 as the plan intends, or
  deferred to Phase 2. Prefer deferring to Phase 2 to avoid a speculative
  extraction shape before the table's own adapter exists.
- **Extracted utilities stay `@internal`** — `libs/components/src/lib/internals/`
  is already package-private (not in `src/index.ts`) and is the established home
  (`virtual-window.ts`, `typeahead.ts`, `dom-order.ts`). Promote to public later
  only if apps need to build their own "from query" glue.

### Typed column model

- `etTable` headless directive is generic over `T`: `etTable [data]="rows()"`.
- Columns are declared as **content children**, one directive per column, each
  carrying a typed accessor: e.g.
  `<ng-container etTableColumn="name" [accessor]="..." />` where the header/cell
  templates get a typed context (`$implicit: T`, `value: V`) enforced by
  `ngTemplateContextGuard`. The exact authoring shape (pure template-driven vs.
  a `createTableColumns<T>()` helper array passed as input) is an API decision
  for the implementer — template-driven is the primary, Angular-idiomatic path
  for statically known tables.
- **Data-driven columns are equally first-class** (see the list-view reference
  consumer: column sets arrive from the server as config with a `type` field).
  Support a columns-as-data input where each column def pairs a key with a
  **cell renderer** — a projected typed template picked by column type, or a
  registered renderer component. The SDK ships a few generic renderers (text,
  boolean/badge-ish) as opt-in imports; apps register their own for
  domain-specific types (`image_text`, …). Both paths produce the same internal
  column model, so every feature (sort, filter, reorder, state) works
  identically with either.
- Column identity is a string key but always paired with the typed accessor —
  the key exists for state serialization (order, visibility, sort, filter),
  never for wiring templates to data.

### Feature plugins (each its own directory + secondary import, tree-shakable)

| Feature                    | Shape                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sort headers               | `etTableSort` (table-level state) + `etTableSortHeader` on a column header; tri-state; multi-sort optional input. Emits typed `{ key, direction }[]`.                                                                                                                                                                                                    |
| Filter headers             | `etTableFilterHeader` opens a menu (reuse `menu`) with a search input + option list or custom projected content; contributes to a table-level typed filter state. Options can be static or **async: paginated + searchable** (list-view filter endpoints) — reuse the `selectOptionsFromQuery` adapter shape (`setQuery`/`loadMore`) for option loading. |
| Sticky                     | Sticky header row by default in the styled component; `etTableStickyRow` / sticky columns as opt-in. Pure CSS where the markup strategy allows.                                                                                                                                                                                                          |
| Row expansion / sub-tables | `etTableExpandableRow` + a detail template outlet; nesting = detail template contains another table. Collapsible, animated (height interpolation), lazy-instantiated detail views.                                                                                                                                                                       |
| Column reordering          | Drag via `core` drag utilities on headers; updates the column-order state; no DOM surgery if grid strategy wins.                                                                                                                                                                                                                                         |
| Selection                  | (Not user-requested but cheap and expected) row selection state + checkbox column helper. Keep last.                                                                                                                                                                                                                                                     |
| Virtualization             | Shared windowing utility from Phase 0; opt-in `etTableVirtualScroll`-style directive; must compose with expansion (variable heights → measured heights like the select).                                                                                                                                                                                 |

### Table state export/restore

- A single serializable `TableState` object: column order, visibility, widths
  (if resizing ever lands), sort, filters, expanded row keys, scroll/page hint.
- **Versioned** (`v: 1`) so persisted states survive schema evolution.
- API: `state` as a signal + `restoreState(state)` on the headless table;
  everything else (where it's stored) is adapters:
  - **URL adapter**: bridges to QueryForm / router query params → shareable
    hyperlinks.
  - **Plain object** → consumer persists via their API.
- Row-dependent state (expanded rows, selection) serializes by a
  consumer-provided `rowKey: (row: T) => string`, required only when those
  features are enabled.
- **Shape `TableState` so it maps 1:1-ish onto per-column server config**
  (the list-view reference: per column `hidden`, `valueSortOrder`,
  `filterValues`; plus a top-level search query) — sort/filter state should be
  representable per-column-key, not only as separate top-level lists, so the
  app-side mapping to/from list-view DTOs is mechanical. Named saved views /
  default view / persistence stay app concerns; the SDK only guarantees
  `state()` ↔ `restoreState()` round-trips. Do **not** import the list-view
  schema into the SDK.

### Query lib integration

**Mirror the select's proven adapter pattern** —
`selectOptionsFromQuery()` in
`libs/components/src/lib/forms/select/select-options-from-query.ts` (and its
`select-options-from-v2-query.ts` twin for the other client). Read both before
designing this layer; the table version should feel like the same API family:

- Base table takes plain `T[]` (or a signal thereof) — zero query dependency.
- The glue is a **plain adapter function** (tree-shakable by construction, no
  directive/DI needed), e.g. `tableRowsFromQuery({ queryCreator, args, toRows,
toTotal, ... })`, called from an injection context like the select's. It
  returns an object of signals the consumer binds to the table:
  `rows`, `loading`, `error`, plus pagination info — and imperative hooks the
  table's outputs feed back into: `setSort`, `setFilters`, `setPage` (the
  select's `setQuery`/`loadMore` shape). Sort/filter/page state changes rebuild
  the reactive `args`, the query re-executes, rows update.
- **Legacy query client support is required**, exactly like the select's twin
  adapters: ship a variant per client (`tableRowsFromQuery` /
  `tableRowsFromV2Query` or equivalent). To avoid maintaining the same
  machinery four times (select + table × two clients), **extract the select
  adapters' client-facing core** — query lifecycle, reactive args rebuild,
  loading/error derivation, page accumulation, the `setQuery`/`loadMore`
  hooks — into a shared generic utility in Phase 0, alongside the
  virtualization extraction. Select and table adapters then become thin, typed
  wrappers over it. Same rule as the windowing extraction: the select's
  existing specs (`select-options-from-query.spec.ts`,
  `select-options-from-v2-query.spec.ts`) must stay green. Known third
  consumer: the filter overlay's results-preview query (`10-filter.md`
  Layer 2) uses the non-paginated slice of this core — keep the pagination
  accumulation layerable rather than baked in.
- Loading state renders skeleton rows (dep on `03-skeleton.md` — or ship a
  minimal busy row first); error state via the query error shapes; pagination
  wires `Paginated<T>` types + `02-pagination.md`'s paginator.
- Server-side mode (= the adapter above): the table renders whatever comes
  back, no client-side sorting/filtering applied.
- Client-side mode: small pure helper functions (`sortRows`, `filterRows`) —
  importable, tree-shakable, not baked into the core.

## Phases (each = shippable PR: code + stories + docs + changeset)

- **Phase 0 — Spike + extraction (no public API)**: markup-strategy prototype
  (A vs B above, verify sticky+virtual+reorder feasibility in Storybook).
  **Decisions recorded** in the "Phase 0 decisions" block above — key outcomes:
  markup = B (grid); windowing is **already extracted** (`createVirtualWindow`),
  so nothing to do there; the query-adapter core extraction is the only refactor
  and is **deferred to Phase 2** (it serves the query glue, not the core table);
  extracted utilities stay `@internal`. Remaining Phase 0 work is the rendered
  Storybook markup prototype confirming sticky + virtual + reorder before Phase 1
  locks the markup.
- **Phase 1 — Core table**: ✅ **shipped 2026-07-23** (`libs/components/src/lib/table/`).
  Default `et-table` component + typed columns via `tableColumns<T>()` (the chosen
  primary API — full accessor inference; a per-column template-driven authoring
  path was rejected for Phase 1 because Angular can't infer `T` into an ancestor
  column directive's cell context), CSS-grid markup (`display: contents` rows so
  columns align across all rows), sticky header, empty state (`emptyLabel` +
  `[etTableEmpty]`), surface-token theming, and a versioned `state()` /
  `restoreState()` (column order + visibility) as the state-container seed. Story
  verified in Storybook (grid, sticky-while-scrolled, custom cell, empty); spec +
  docs guide + `ET35xx` + changeset done.
  **Deferred, needs review:** a separate headless `[etTable]` directive was NOT
  built — the default component carries the state inline. Whether a headless tier
  is needed (and its exact shape) is a public-API call best made when a feature
  (sort/filter, Phase 2/3) or a custom-markup consumer actually needs it; the
  component's signals (`visibleColumns`, `state`, …) are already the extension
  surface a feature directive would `inject(TableComponent)` to read.
- **Phase 2 — Sort + query glue**: 🟡 **sort shipped 2026-07-23** — `sortable`
  columns render tri-state sortable header buttons (`aria-sort`), a two-way
  `sort` model (`{key,direction}[]`), `multiSort`, and a `sortMode`
  (`'client'` applies the exported tree-shakable `sortRows({rows,sort,columns})`;
  `'server'` leaves rows so `sort()` feeds query args). Spec + Storybook-verified,
  docs + changeset. **Phase 2b — `tableRowsFromQuery` shipped 2026-07-23**
  (`table-rows-from-query.ts`, signals client): created-once query re-executing on
  sort/page, returns `rows`/`loading`/`error`/`total`/`hasMore`/`sort`/`page` +
  `setSort`/`setPage`, keeps the previous page visible during load, resets page on
  sort. 4-case spec (HttpTestingController) + docs + changeset. **Still remaining:**
  the legacy `V2QueryClient` twin, and factoring the shared query-lifecycle core
  out of the select + table adapters (the Phase 0 extraction — now safe since the
  table adapter's shape is proven). Deferred to avoid touching the production
  select adapters mid-phase.
- **Phase 3 — Filter headers**: menu + search composition, typed filter state,
  client helpers + server wiring.
- **Phase 4 — Row expansion / nested sub-tables**.
- **Phase 5 — Column reordering** (+ visibility toggling, which state
  serialization needs anyway).
- **Phase 6 — Virtualization** (compose with Phase 4's variable heights).
- **Phase 7 — State export/restore** (TableState, URL adapter, docs recipe
  "restore a table from a link"). Depends on 2/3/5 states existing but the
  state container should be designed in Phase 1 so features register into it.

Dependencies on other plans: `02-pagination.md` (query glue), `03-skeleton.md`
(loading rows) — both nice-to-have, not blockers.

## Explicitly out of scope (park as future ideas)

Cell editing, row grouping/aggregation, pivot, CSV/Excel export of _data_
(state export ≠ data export), column resizing (mention in docs as not-yet),
tree data (nested sub-tables cover the requested case).

## A11y checklist (applies to every phase)

Grid/table ARIA per markup strategy, full keyboard nav for sort/filter/expand/
reorder, `aria-sort` on sorted headers, focus management when menus open/close,
reduced-motion for expansion animation, announce async row updates
(`aria-busy` while loading).
