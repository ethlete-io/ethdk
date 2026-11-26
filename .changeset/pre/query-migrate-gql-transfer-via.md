---
'@ethlete/query': patch
---

`migrate-to-query-v3` names `createGqlQueryViaGet` in the task for a GraphQL creator whose v2 client set `request.gql.transferVia: 'GET'`, and no longer warns about that dropped option.
