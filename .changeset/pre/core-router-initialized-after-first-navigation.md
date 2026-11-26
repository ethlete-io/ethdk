---
'@ethlete/core': patch
---

`injectIsRouterInitialized()` is now `true` only once the first navigation has ended, so a component created during it sees `false`.
