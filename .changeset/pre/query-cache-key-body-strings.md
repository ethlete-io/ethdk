---
'@ethlete/query': patch
---

Cache keys no longer merge request bodies that differ only in whitespace or braces inside strings (GraphQL POST variables like `'new york'` vs `'newyork'`); persisted entries of requests with a body miss once after upgrading.
