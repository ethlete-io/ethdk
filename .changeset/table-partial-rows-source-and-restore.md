---
'@ethlete/components': patch
---

Table: a `rowsSource` with `setSort`/`setFilters` but no `sort`/`filters` signal no
longer freezes the header, and a hand-edited stored state or link is ignored instead
of crashing `restoreState()`. A signal published without its setter now throws
`ET3510` in dev mode.
