---
'@ethlete/query': patch
---

`prep-for-query-v3` rewrites `CLEAR_QUERY_ARGS` to `null` and drops its import, and warns about each `withArgs` callback that returns `null`, which now parks the query instead of keeping the previous args.
