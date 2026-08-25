---
'@ethlete/query': patch
---

Query: `withPersistentAuth` clears its cookie in every scope the page can reach, not only the registrable domain, so a cookie on an intermediate parent domain can no longer shadow the one it writes.
