---
'@ethlete/components': minor
---

Overlay router navigations stay synchronous for as long as their guards answer synchronously, instead of going async as soon as any guard is registered.
