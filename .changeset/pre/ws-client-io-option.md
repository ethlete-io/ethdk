---
'@ethlete/query': major
---

`createWebSocketClient` now takes socket.io's `io` as a required option, so `@ethlete/query` no longer
pulls `socket.io-client` (~13 kB gz) into apps that never open a socket. New:
`createWebSocketTestDouble()` in `@ethlete/query/testing`.
