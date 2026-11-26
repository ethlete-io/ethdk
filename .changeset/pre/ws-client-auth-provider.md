---
'@ethlete/query': minor
---

`createWebSocketClient` accepts an `authProvider`: the handshake carries its access token, the socket waits for the session restore, reconnects on login, and disconnects and completes its rooms on logout.
