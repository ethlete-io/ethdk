# Table API: the seams, and what is still open

The 2026-07-27 RFC that reshaped the table API is implemented - columns are a keyed record, cell
templates are content-child directives with an inferred context, and every feature is a directive on
`<et-table>` rather than a child element. The consumer-facing API is documented in
`apps/docs/components/table.md`; this file keeps only the decisions a future edit could
accidentally undo, and the questions nobody has answered yet.

## The four seams

Features register into the base table rather than templating into it, which is what keeps an unused
feature out of the bundle:

- **A - `registerLeadColumn`**: leading utility cells (selection checkbox, expander).
- **B - `registerHeaderAdornment`**: header chrome (filter trigger, resize grip), ordered by an
  `order` number.
- **C - `registerRowWindow`**: a slice function plus row metrics (virtual scroll).
- **D - `registerLayer`**: a feature's own floating UI, rendered after the grid - this is how the
  reorder ghost/indicator exists without reorder needing an element.

Two properties are easy to break and were deliberate:

- Registrations carry an optional **`enabled: Signal<boolean>`**, because a directive cannot be
  conditionally applied the way `@if (resizable()) { … }` could.
- Feature cells are stamped with `NgComponentOutlet` and resolve from the **feature's own injector**,
  which is what lets a stamped cell `inject()` the feature that registered it. (The table's own
  expander cell needs no injector - it is created in the table's view.)

## Decisions that look like omissions

- **There is no `tableColumns()` helper.** TypeScript has no partial type argument inference, so
  `tableColumns<Row, C>(…)` cannot infer `C` while `Row` is explicit, and defaulting `C` throws the
  per-column value types away. `satisfies TableColumns<Row>` gives the same contextual typing of
  every `value` accessor with better per-property errors.
- **`expandedRowTemplate` is a table input, not an `etTableDetail` directive.** A detail template is
  not in the column objects, so it never had the problem the RFC fixed, and a content-child directive
  cannot infer the row type without a witness input to bind - there is no column to bind for a
  table-wide template.

## Open questions

- **Per-cell component instances.** Seam A stamps one component per lead cell per row, and the
  table's own expander cell is one too. Bounded by the virtual window when it is on, unbounded when
  it is not. Never measured on a 2,000-row selection table; a carrier-component fallback (one
  instance per table, cells as templates) exists if it ever regresses.
- **Header adornment ordering.** The `order` numbers (filters 0, resize 10) survive from the
  template era; a named slot (`'trailing'`) may read better now that the chrome is components.
- **Does the `group` header row need the same treatment?** Group labels are plain strings today. An
  `etTableGroupHeader` template directive would round out the seam, but nothing has asked for it.
- **Sizing.** Per-feature deltas (2026-07-27): resize +0.5 kB, virtual scroll +0.7 kB, reorder
  +1.4 kB, selection +2.8 kB, filters +9.8 kB, all five +14.9 kB gz. Filters grew ~1 kB and reorder
  ~0.2 kB when their templates became components - the price of features having no view of their own.
  Absolute numbers from that run are not comparable to a fresh one; re-measure both sides together
  with `tools/treeshake`.
