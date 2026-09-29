---
'@ethlete/core': patch
---

The `provideAppUpdates` check no longer logs CSP `style-src` violations under a nonce policy. It reads the entry scripts from the fetched HTML text instead of parsing it with `DOMParser`.
