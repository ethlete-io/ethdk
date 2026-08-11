---
'@ethlete/query': patch
---

`withInactivityLogout` now times out on the session being idle rather than one tab being idle, so a forgotten tab no longer logs the user out of the one they are working in.
