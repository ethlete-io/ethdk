---
'@ethlete/query': minor
'@ethlete/query-devtools': patch
---

Client `headers` and per-request `args.headers` accept a plain record as well as `HttpHeaders`, for secure queries too, so a client needs no `@angular/*` import to set a header.
