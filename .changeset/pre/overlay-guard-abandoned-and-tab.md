---
'@ethlete/components': patch
---

`createOverlayUnsavedChangesGuard` stops vetoing closes once its tracker was abandoned (a logout), so the overlay closes instead of prompting over a page the user is being redirected away from. It also inherits the tracker's tab guard - the `beforeunload` lock is on by default, with the title marker / blink / favicon / badge extras available through the `tab` option.
