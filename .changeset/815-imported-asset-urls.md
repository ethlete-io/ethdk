---
'@ethlete/cli': patch
---

The design frame resolves `url(@assets/...)` in `@import`ed stylesheets, and the new `FONT-FACE` render rule fails a part whose `@font-face` does not load.
