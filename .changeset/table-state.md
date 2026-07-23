---
'@ethlete/components': minor
---

Table: `state()` / `restoreState()` now capture sort, filters and expanded rows
per column (not just order + visibility) and round-trip losslessly. New
`serializeTableState()` / `deserializeTableState()` turn a snapshot into a URL
query param and back, so a sorted/filtered/reordered table is shareable as a link.
