---
'@ethlete/core': patch
---

`injectUrl`, `injectRoute` and `injectRouterEvent` read the url before the first navigation through Angular's `Location`, so it no longer carries the base href or, under a hash location strategy, the `#`.
