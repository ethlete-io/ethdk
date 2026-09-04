---
'@ethlete/query': patch
---

GraphQL: production minification now drops `#` comments and leaves string literals untouched, so a commented document no longer breaks once built for production.
