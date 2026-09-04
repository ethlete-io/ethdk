---
'@ethlete/query': patch
---

Secure GraphQL queries via POST are now cached and deduplicated like their non-secure counterparts, and a secure mutation via GET is no longer re-run by `refreshQueriesInUse()`.
