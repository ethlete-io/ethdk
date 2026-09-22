---
'@ethlete/query': patch
---

`socket.io-client` is an optional peer dependency. It is only imported by `createWebSocketClient`,
and no non-`ws` public type surfaces it, so an app that does not use the realtime client no longer
has to install it.
