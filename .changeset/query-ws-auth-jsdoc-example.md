---
'@ethlete/query': patch
---

The JSDoc example of the `createWebSocketClient` `auth` option no longer reads the token from the auth provider: the function runs outside an injection context, so it reads the token from the app's own store.
