---
'@ethlete/cli': patch
---

A design drawing may leave out `styles`: `drawing({ body })` is enough when `definePart({ styles })` carries the stylesheet, and a part's `render` still answers a string of styles.
