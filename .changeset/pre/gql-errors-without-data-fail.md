---
'@ethlete/query': minor
---

A GraphQL `200` with `errors` and no `data` now fails with `ET601` carrying the server's errors, and the error-message ladder reads `{ errors: [{ message }] }` and `[{ message }]` bodies.
