---
'@ethlete/query': patch
---

WebSockets: a room joined before the socket connects sends one `join-room`, and a frame carrying no `room` string is reported as malformed without flooding production logs.
