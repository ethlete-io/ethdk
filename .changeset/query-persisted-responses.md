---
'@ethlete/query': major
'@ethlete/components': patch
---

Query clients now keep successful **public** reads in IndexedDB, so a reload — or a cold start with no
network — renders the last known data while revalidating. On by default: `persistence: false` opts out
per client, `persistence` per query. Secure responses need an explicit opt-in and are removed on logout.
The devtools cache view gains a _Disk_ column.
