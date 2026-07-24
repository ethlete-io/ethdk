---
'@ethlete/components': minor
---

Add a type-safe, light-by-default **Table** component (`et-table`, `TABLE_IMPORTS`).

Columns are declared with the typed helper `tableColumns<T>()`, so the row type flows into every `value` accessor (and, via each column's `key`, into serializable state) without wiring templates to data by string. Rows and cells render on a CSS grid with a sticky header; the table is its own scroll container (give it a bounded height to scroll a body under the pinned header). Colors come from the surface theming tokens, and any cell can hold custom content via `cell` / `headerCell` templates.

- **Appearance & density**: `appearance` (`'enclosed'` default, `'divided'`, `'zebra'`, `'grid'`, `'bare'`) and `density` (`'sm'`, `'md'` default, `'lg'`).
- **Sorting**: `sortable` columns with tri-state `aria-sort` headers, a two-way `sort` state, `multiSort`, and `sortMode` `'client'` (exported `sortRows`) / `'server'`.
- **Filtering**: `filterable` columns with a multi-select menu, two-way `filters` state, `filterMode` `'client'` (exported `filterRows`) / `'server'`, plus in-menu search and async/paginated options.
- **Row expansion**: `expandedRowTemplate` renders lazy, reduced-motion-aware detail rows (nest a table for sub-tables); `expandableRow` gates rows, `expandedKeys` is two-way.
- **Selection**: `selectable` adds a checkbox column driving a two-way `selection` set of row keys, with select-all/indeterminate header and `selectableRow` gating.
- **Column reordering & visibility**: `reorderable` drag-to-reorder (floating ghost preview, deferred + animated drop) plus `moveColumn` / `setColumnVisible` / `toggleColumnVisibility`.
- **Grouped headers**: a column `group` spans adjacent columns under one label in a second header row; each sub-column stays independently sortable/filterable.
- **Sticky columns & footer**: `sticky: 'start' | 'end'` pins columns during horizontal scroll; a column `footerCell` renders a bottom-pinned summary row.
- **Footer slot**: project `[etTableFooter]` for a full-width bar below the grid (pinned to the scroll bottom, rendered only when used) — drop in an `<et-pagination>` + page-size `<et-select>` and wire them to `tableRowsFromQuery`.
- **Virtualization**: `virtualScroll` (with `estimateRowHeight` / `overscan`) renders only the rows near the viewport for long lists.
- **State**: versioned `state()` / `restoreState()` capture column order, visibility, sort, filters and expanded rows and round-trip losslessly; `serializeTableState` / `deserializeTableState` make a table shareable as a URL query param.
- **Query integration**: `tableRowsFromQuery` (and the legacy `tableRowsFromV2Query` twin) feed the table from an `@ethlete/query` query with server-side sort/filter/pagination.
