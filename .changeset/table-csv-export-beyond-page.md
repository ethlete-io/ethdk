---
'@ethlete/components': minor
---

Table: the CSV export can write more than the loaded page. `rows` now also takes a **provider** -
a function returning an observable or promise of rows - and `tableCsvRowsFromPages({ fetchPage })`
walks a paginated endpoint to produce one, fetching pages one at a time. `file` saves a CSV the
**server** built instead (an `@ethlete/query` query, followed not executed, a promise, or an
observable of `Blob | string`), skipping client-side serialization entirely.

Because an export may now have to fetch, `injectTableCsvExport()` and `toCsv()` return observables
that do the work on subscribe, and the directive exposes an `exporting` signal for the button's busy
state (`export()` itself stays fire-and-forget).

A server-paginated table that would silently export one page of many is now a dev-mode error
(`ET3506`) instead: `TableRowsSource` gained an optional `total`, which `tableRowsFromQuery` already
provides, and `partial: true` is the opt-in for a deliberate "export this page". `ET3507` catches
`file` passed alongside options that can only apply to a file this side builds.
