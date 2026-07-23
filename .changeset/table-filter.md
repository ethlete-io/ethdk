---
'@ethlete/components': minor
---

Table: add column filtering. Mark columns `filterable` with `filterOptions` and the header renders a multi-select filter menu (built on `menu`) that drives a two-way `filters` state (`{ key, values }[]`). `filterMode` toggles `'client'` (filters rows in the browser via the exported, tree-shakable `filterRows({ rows, filters, columns })` — AND across columns, OR within) and `'server'` (leaves rows for the backend). `filterValue` matches on a value other than the displayed one. The `tableRowsFromQuery`/`tableRowsFromV2Query` adapters gained `filters`/`setFilters` so server-side filtering feeds query args alongside sort/page.
