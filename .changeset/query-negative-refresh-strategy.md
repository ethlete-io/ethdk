---
'@ethlete/query': patch
---

Auth: a negative numeric `refreshStrategy` now counts as `0`, so the proactive refresh fires at token expiry instead of after it.
