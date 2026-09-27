---
'@ethlete/query': patch
---

The web socket client now reconnects with backoff and the current `auth` after a server disconnect or rejected handshake, resets its backoff after 10 s of uptime, and opens no connection during a server render.
