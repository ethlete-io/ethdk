---
'@ethlete/query': patch
---

Auth: a login that races the cookie restore no longer leaves `sessionStatus()` stuck on `'restoring'`, which pended every route guard for the life of the tab.
