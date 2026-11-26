---
'@ethlete/components': patch
---

Fix opening an overlay from an `effect` or `computed`, which threw NG0602 and left the overlay half-open.
