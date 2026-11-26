---
'@ethlete/components': minor
---

Table: add CSV export - `TABLE_CSV_EXPORT_IMPORTS` / `etTableCsvExport` for a button of your own, or
`injectTableCsvExport()` / `tableToCsv()` from TypeScript. It writes the visible columns and the
table's own rows by default (`exportValue` gives a column its text form), `rows` also takes a provider
function, `tableCsvRowsFromPages({ fetchPage })` walks a paginated endpoint, and `file` saves a CSV the
server built instead. A server-paginated table that would silently export a single page is a dev-mode
error (`ET3506`) unless you pass `partial: true`.
