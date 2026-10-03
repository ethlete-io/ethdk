---
'@ethlete/query': patch
---

Fix three request-building bugs: query params added to a route that already has a query string are now appended with `&` instead of a second `?`; `sortQueryField` (and `transformToSort`) now reads a field that contains a colon, e.g. `meta:created:desc`, back as it was written; and a GraphQL operation with directives (`query GetUser @cached { … }`) now sends its `operationName`.
