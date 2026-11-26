---
'@ethlete/query': patch
---

The v2 migration adds `destroyOnResponse` only to a query that is provably one-shot, so a stored, returned or re-executed query keeps working after its first response.
