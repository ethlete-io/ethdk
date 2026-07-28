---
'@ethlete/components': patch
---

Log the logout-wide secure unbind in the query devtools event log. A logout drops every secure cache
entry at once; without a row of its own, the requests disappearing from the cache view had no visible
cause.
