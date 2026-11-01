---
'@ethlete/cli': patch
---

`design compare` waits until the app opened and settled as many overlay panes as the design picture draws before it shoots the app, so a popover that opens on mount is no longer missing from the app picture.
