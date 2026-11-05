---
'@ethlete/query': patch
---

The `migrate-to-query-v3` report lists every call site of the v2 auth hooks (`setAuthProvider`, `clearAuthProvider`, `authProvider$`, `isBearerAuthProvider`) and every `HttpInterceptor` that sets an `Authorization` header.
