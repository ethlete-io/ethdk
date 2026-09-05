---
'@ethlete/query': patch
---

GQL over POST now sends `variables` as a JSON object in the body, as the GraphQL-over-HTTP spec requires; GET keeps the JSON string. The body change moves the cache key of a POST gql query once.
