---
'@ethlete/query': patch
---

The web socket client now reconnects with backoff and the current `auth` after a server disconnect or a rejected handshake, and opens no connection during a server render.
