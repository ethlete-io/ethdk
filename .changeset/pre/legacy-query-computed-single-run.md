---
'@ethlete/query': patch
---

Legacy `queryComputed` no longer runs its computation twice on creation, which sent a mutation twice and replaced the query it returned synchronously.
