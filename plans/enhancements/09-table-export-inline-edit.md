# 09 — Table: CSV export, inline editing, keyboard grid navigation

Three phases on top of the shipped green-field table (plan
`cdk-port/01-table.md`, phases 1–9 done). All three follow the table's
plugin/opt-in architecture so non-users don't pay (see
`plans/table-tree-shaking.md` conventions).

## Phase 1 — CSV export (S–M) — **done 2026-07-31**

Zero export surface exists today. Every mature grid ships it.

- Opt-in feature (directive or standalone helper) — recommend a plain exported
  function + a small directive wrapper for the common case:
  `exportTableToCsv(table, options)` where options cover: visible columns only
  vs. all (respecting column-chooser visibility + reorder order), all rows vs.
  current page vs. selected rows (integrates `table-selection`), header labels
  (column `label` by default), delimiter, filename.
- Cell serialization: a column's export value defaults to its raw data
  accessor (typed columns make this clean); `exportValue?: (row) => string`
  per column for template-rendered columns (templates can't be serialized —
  document that clearly).
- Correct CSV quoting/escaping + BOM for Excel; `text/csv` blob download.
  No Excel (.xlsx) format — CSV only, note as non-goal.
- Rows source: works against the table's current data input; for
  server-paginated tables "all rows" is the consumer's job (they have the
  query) — the helper exports what the table has. Document this boundary.

## Phase 2 — inline cell editing (L)

`table.types.ts:56-65` (`cellState`/`TableCellStateValue`) already models
per-cell loading/error for externally-driven edits — the comment literally
anticipates inline editing. Missing: the edit UI + interaction flow.

- Opt-in editing feature per column: `editable` column config with an edit
  template (consumer renders an `et-input`/select/etc. bound via signal-forms
  `[formField]` — the lib's controls are signal-forms native, lean on that
  instead of inventing a cell-editor abstraction).
- Interaction flow (grid-standard): Enter or double-click enters edit mode on
  the focused cell; Enter commits, Escape cancels (restores), Tab commits and
  moves. One cell in edit mode at a time (v1; row-edit mode is out of scope).
- Commit emits an event with `{ row, column, previous, next }`; the consumer
  performs the mutation (query) and drives the existing `cellState`
  loading/error — the feature wires the two together so the cell shows its
  pending/error state automatically after commit.
- Focus management: edit mode moves focus into the editor; commit/cancel
  returns focus to the cell. Depends on Phase 3's cell focus model — build 3
  before or together with 2.

## Phase 3 — arrow-key cell navigation (M) [prereq for Phase 2 UX] — **done 2026-07-31**

Docs self-acknowledge: only sortable headers are keyboard-operable; "Full grid
keyboard navigation arrives with the later interactive features."

- Roving tabindex over body cells (one tabstop for the grid body; arrows move
  cell focus, Home/End row bounds, Ctrl+Home/End grid bounds, PageUp/Down by
  visible page). Follow the ARIA grid pattern; the calendar's roving grid
  implementation is the in-repo reference.
- Must compose with virtualization (`table-virtual-scroll.directive.ts`):
  focus target may not be rendered — scroll it into range first, then focus.
  This is the hard part; design the focus model against the virtual window's
  API, not `querySelector`.
- Interactive cell content (links/buttons in cell templates): Enter drills in,
  Escape returns to cell — standard grid pattern.
- Opt-in directive (`etTableKeyboardNav` or as part of the editing feature) so
  read-only display tables don't change tab behavior; when enabled, role
  semantics upgrade toward `grid` (verify against the table's current role
  structure — don't ship a half-`grid`).

## Found while implementing (2026-07-31, phase 1 — CSV export)

**The feature host can't see cell values, so the export isn't a feature.** `TableFeatureHost` hands
features `TableColumnMeta`, which is `TableColumnDef` _minus_ `value`/`sortValue`/`filterValue` —
deliberately, so the row type never leaks into the seam. An exporter needs exactly those. So the
serializer is typed against a small structural `TableCsvSource<T>` (`rows()`, `visibleColumns()`,
`allColumns()`) that `TableComponent` happens to satisfy: it stays a pure function, the headless layer
never imports the component, and a test can pass a plain object. `etTableCsvExport` is a thin wrapper
that injects the table and registers nothing.

**`rows: 'selected'` was dropped in favour of `rows: readonly T[]`.** Resolving `'selected'` would mean
either the host contract growing a selection-shaped member (which is what the register-don't-query
architecture exists to avoid) or the export statically referencing `TableSelectionDirective` — which
would drag the checkbox into every table that exports. `rows: selection.selectedRows()` is the same
thing, typed, with no coupling, and it also covers "export my unfiltered data" and "export every page".

**The download can't be a plain function** — `no-restricted-globals` and
`ethlete/no-direct-dom-manipulation` both fire on `document.createElement`. It is therefore
`injectTableCsvExport()`, called once in a field initializer, returning the function; it takes
`DOCUMENT` and `injectRenderer()` and no-ops when the document has no `defaultView` (SSR). `tableToCsv`
stays pure, which is what the tests exercise.

**CSV injection is guarded by default.** A text field starting with `=`, `+`, `-`, `@`, tab or CR gets
a `'` prefix, _unless_ the string is a finite number — so `-5` and `+1` are written as-is (they are
inert) while `-5+A1` and `+cmd|' /C calc'!A0` are escaped. Not in the plan, but a library that writes
user data into a file Excel opens should not ship the footgun; `formulaGuard: false` opts out.

**Verified in a real browser** (`components-table--csv-export`, driven headlessly): the file downloads
as `people.csv` with a `efbbbf` BOM and CRLF line endings, re-exporting after sorting Name descending
reorders the file, the second button writes only the two ticked rows to `people-selection.csv`, and the
anchor leaves nothing behind in the document.

## Found while implementing (2026-07-31, phase 3 — keyboard navigation)

**The roving tabindex is not a template binding.** Putting it in the cell view model would rebuild
every rendered row's VM on each arrow press. Instead the base table renders `tabindex="-1"` on body
cells whenever a cell-navigation feature is registered (one boolean, `cellNavigation()`), and the
feature moves the single `tabindex="0"` itself — two attribute writes per move, and it holds the
element rather than querying for it. An `afterEveryRender` re-anchors the stop when a render destroyed
the cell it was on, which is every scroll of a windowed table and every sort/filter/page change of any
table; `isConnected` is how that is noticed.

**Positions are arithmetic, not DOM traversal.** `ethlete/no-dom-query` bans `closest`/`querySelector`,
so the feature follows the reorder directive's pattern: `event.composedPath()` matched against
`bodyCellElements()` (every rendered data cell, rows major). The found index carries both coordinates —
`row = renderedRowOffset() + floor(i / columns)`, `column = i % columns` — which is also exactly the
mapping `bodyCellElementAt()` inverts. No `data-row-index` attribute was needed in the end.

**Virtualization needed a new seam.** `TableRowWindow` gained an optional `scrollToIndex`, which the
virtual-scroll directive fills from the window utility's own method. Without it a windowed table can
only be navigated inside what is already rendered. The order is: ask the window to scroll, then focus in
`afterNextRender` — the element does not exist before that render. Verified: 25×ArrowDown scrolls and
keeps focus; Ctrl+End reaches the true last cell (scrollTop ~89 600 on the 2 000-row story).

**Two deliberate changes to existing behaviour**, both documented: `rowInteractive` rows stop carrying
`tabindex` while navigation is on (the body is one tab stop, not two), and lead cells (selection
checkbox, expander) stay out of the arrow order — they are their own tab stops, reachable with Tab as
before.

**Drill-in can't be unit-tested here.** `Enter` resolves the cell's focusable content with core's
`getFocusableElements`, which filters on `getClientRects()` — always empty in jsdom, so every element
reads as unfocusable. The spec asserts the drilled-in _state_ instead (arrows belong to the control,
Escape returns, the cell keeps the tab stop) and the Enter step is verified in a real browser
(`components-table--keyboard-navigation`).

## Phase 4 — export beyond the loaded page (M) — **designed 2026-07-31, not built**

Phase 1 exports what the table holds. For a server-paginated table that is one page, silently — the
user clicks Export on page 3 of 200 and gets a plausible-looking, wrong file. Three routes out, in the
order they matter in practice:

**1. A server-side export endpoint (the common case).** Backends usually grow a
`GET /people/export?filters=…` that returns the whole dataset as `text/csv`. Nothing is serialized
client-side there — the file already exists. Add an option that takes a **v3 (`@ethlete/query`)
query**, a promise or an observable resolving to `Blob | string`, and saves it under `filename`.
Follow the query rather than execute it, exactly as `notification-promise.ts` does (duck-typed on
`'executionState' in query`, see `isQuery` there); `components` already depends on `query`, so this
costs no new dependency. Mutually exclusive with `rows`/`columns`/`delimiter` — dev error if both are
given, since those options cannot apply to a file the server wrote.

**2. An all-pages adapter, for backends without such an endpoint.** A small
`tableCsvRowsFromPages({ fetchPage, hasMore })` helper that loops a page fetcher and concatenates,
so every consumer doesn't hand-roll it. It produces exactly what route 3's `rows` provider consumes.

**3. `rows` accepts an async provider.** Widen it from `readonly T[]` to
`readonly T[] | (() => Promise<readonly T[]> | Observable<readonly T[]>)`. `export()` becomes
awaitable and the directive exposes an `exporting` signal so the button can disable and show a
spinner while the pages come in. The existing array form (a selection) is unchanged.

**Plus: make the partial export deliberate rather than accidental.**
`TableRowsSource` has no total, but `TableRowsFromQuery` already computes one
(`total: Signal<number | null>`) — adding an optional `total?: Signal<number | null>` to
`TableRowsSource` is satisfied structurally by what already ships. With it, the export can tell it
holds 20 of 4 312 rows and, **in dev mode only**, throw `ET3506`: "CSV export would write 20 of 4312
rows — pass `rows`, or `partial: true` to export the loaded page on purpose." Production stays silent
and exports the page. `partial: true` is the opt-in, and is also what an explicit "Export this page"
button in the docs' two-button pattern passes.

Selection export needs no change: the selection is by definition what is loaded.

## Verification & shipping

Storybook: export story (download assertion via Playwright), editing story
(commit/cancel/Tab flows, pending + error cell states), keyboard-nav story
incl. virtualized (scripted arrow-key traversal past the render window).
Docs: `table.md` new sections per phase; update the Accessibility section's
"arrives later" sentence when Phase 3 lands. Changesets per phase
(`@ethlete/components` minor).
