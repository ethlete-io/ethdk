---
'@ethlete/query': patch
---

WebSockets: a room joined before the socket connects now sends one `join-room` instead of two; rooms are still re-joined after a reconnect.
