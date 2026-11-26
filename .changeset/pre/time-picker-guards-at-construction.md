---
'@ethlete/components': patch
---

Time picker: the structural dev guards `ET3020` and `ET3021` now throw while the directive is constructed, on the template's stack, instead of once per element after the first render.
