---
'@ethlete/core': patch
---

`registerScrollRestorationState` now restores a page that registers after the navigation ended, such as a route component behind a nested `<router-outlet>`, on reload and back/forward navigation. The offset waits for that state before it is applied.
