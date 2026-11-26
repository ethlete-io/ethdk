---
'@ethlete/cli': patch
---

`design compare` no longer fails when the app opens fewer overlay panes than the design draws, such as a static dialog. It waits 3 seconds for the panes, then shoots anyway so the pixel compare decides.
