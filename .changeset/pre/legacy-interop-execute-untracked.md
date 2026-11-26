---
'@ethlete/query': patch
---

Legacy interop: `execute()` and `abort()` read the query state untracked again, so `queryComputed(() => legacyQuery.prepare(...).execute())` no longer re-runs on every state change and floods the API until the tab runs out of memory.
