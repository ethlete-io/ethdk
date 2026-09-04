---
'@ethlete/query': patch
---

Query devtools: release a query's response-override recorder when the query is destroyed, so a long-lived app no longer holds on to every query that ever had an override armed.
