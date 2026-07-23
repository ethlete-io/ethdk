---
'@ethlete/components': minor
---

Table: add sorting. Mark columns `sortable` (with an optional `sortValue` accessor) and the table renders sortable header buttons that cycle unsorted → ascending → descending, manage `aria-sort`, and drive a two-way `sort` state (`{ key, direction }[]`). `multiSort` layers multiple columns; `sortMode` toggles between `'client'` (sorts rows in the browser, nullish last) and `'server'` (leaves rows for the backend, so `sort()` maps onto a query form's sort field). The pure `sortRows({ rows, sort, columns })` helper is exported for custom flows.
