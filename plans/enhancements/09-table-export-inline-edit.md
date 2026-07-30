# 09 — Table: CSV export, inline editing, keyboard grid navigation

Three phases on top of the shipped green-field table (plan
`cdk-port/01-table.md`, phases 1–9 done). All three follow the table's
plugin/opt-in architecture so non-users don't pay (see
`plans/table-tree-shaking.md` conventions).

## Phase 1 — CSV export (S–M)

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

## Verification & shipping

Storybook: export story (download assertion via Playwright), editing story
(commit/cancel/Tab flows, pending + error cell states), keyboard-nav story
incl. virtualized (scripted arrow-key traversal past the render window).
Docs: `table.md` new sections per phase; update the Accessibility section's
"arrives later" sentence when Phase 3 lands. Changesets per phase
(`@ethlete/components` minor).
