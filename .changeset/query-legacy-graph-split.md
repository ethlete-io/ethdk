---
'@ethlete/query': patch
---

Internal: the current generation no longer imports anything from the legacy V2 tree — `buildRoute`,
`buildQueryString`, `buildTimestampFromSeconds`, `decryptBearer`, `QueryError` and the query-string
types now live in `http/internal/request-route`, and `legacy` re-exports them. Every public name is
unchanged. Also closes the `http ↔ gql` cycle.
