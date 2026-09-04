---
'@ethlete/query': patch
---

Persistence: an entry now persists if any bound consumer opted in instead of every sibling needing to agree, and mutations (POST/PUT/PATCH/DELETE) are never written to the store regardless of cache flags.
