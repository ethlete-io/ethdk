---
'@ethlete/query': patch
---

`toQuerySignal` subscribes its source once. A cold source no longer runs twice, so the template no longer shows a query that no container manages.
