---
'@ethlete/query': patch
---

`validateWithQuery` no longer throws `ET100` when the creator's route is a function - its args reach
the query at execute time, which the created query now declares.
