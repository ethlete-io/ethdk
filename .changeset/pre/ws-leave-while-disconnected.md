---
'@ethlete/query': patch
---

A room left while the web socket is down no longer sends a `leave-room` to a fresh session that never joined it; after a recovered reconnect the leave is still sent.
