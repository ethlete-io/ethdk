---
'@ethlete/core': patch
---

Overlay: an overlay's own providers are destroyed when it closes, so an overlay router with `syncUrl` removes its query param from the url again.
