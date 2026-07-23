---
'@ethlete/components': minor
---

Table: add `tableRowsFromQuery` — a server-side data adapter that feeds `<et-table>` from an `@ethlete/query` query (mirroring `selectOptionsFromQuery`). The query is created once and re-executes reactively as sort/page change; it returns `rows`/`loading`/`error`/`total`/`hasMore`/`sort`/`page` signals plus `setSort`/`setPage`, keeps the previous page visible while the next loads, and resets the page on sort change. Pair it with the table's `sortMode="server"`.
