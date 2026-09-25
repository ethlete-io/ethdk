---
'@ethlete/query': minor
---

Every query request now carries the exported `IS_QUERY_REQUEST` `HttpContextToken`, so an app `HttpInterceptor` can skip requests sent by `@ethlete/query`.
