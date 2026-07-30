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

## Phase 3 — arrow-key cell navigation (M) [prereq for Phase 2 UX]

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

## Verification & shipping

Storybook: export story (download assertion via Playwright), editing story
(commit/cancel/Tab flows, pending + error cell states), keyboard-nav story
incl. virtualized (scripted arrow-key traversal past the render window).
Docs: `table.md` new sections per phase; update the Accessibility section's
"arrives later" sentence when Phase 3 lands. Changesets per phase
(`@ethlete/components` minor).
