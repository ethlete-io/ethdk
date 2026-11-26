---
'@ethlete/timetrack': patch
---

`setRowRange` takes a `pinsTo` option that pins a row's end even where it did not move, and `endRowAt` uses it instead of resizing the row from one increment further.
