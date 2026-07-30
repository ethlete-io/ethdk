---
'@ethlete/components': minor
---

Table: add CSV export — `TABLE_CSV_EXPORT_IMPORTS` / `etTableCsvExport` for a button of your own, or
`injectTableCsvExport()` / `tableToCsv()` from TypeScript. Writes the visible columns and the table's
own rows by default; a column gives its text form with `exportValue`. The UTF-8 BOM is written only
when the file needs it (`bom: 'auto'`), so an ASCII export carries no stray marker.
