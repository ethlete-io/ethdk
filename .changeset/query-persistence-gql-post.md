---
'@ethlete/query': patch
---

Query persistence: a GraphQL query sent via `POST` is persisted like a `GET`; the `request-success` repository event now carries `isRefreshable`.
