---
'@ethlete/query': patch
---

The web socket client now reconnects with backoff and the current `auth` after a server disconnect or a rejected handshake, and opens no connection during a server render.

The web socket client's reconnect backoff starts over once a connection stayed up for 10 s, whatever ends it.
