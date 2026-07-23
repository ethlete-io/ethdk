---
'@ethlete/components': minor
---

Table: add row expansion. Provide an `expandedRowTemplate` (context `{ $implicit: row }`) and the table prepends an expander column; each row toggles a lazily-instantiated, full-width detail row with a reduced-motion-aware reveal — nest another `<et-table>` for sub-tables. `expandableRow` gates which rows expand, `expandedKeys` is a two-way `Set` of expanded row keys (by `rowKey`), and `isExpanded`/`toggleExpanded` are available on the instance.
