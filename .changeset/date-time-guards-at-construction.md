---
'@ethlete/components': patch
---

Date & time inputs: the structural dev guards `ET3000`, `ET3001`, `ET3002`, `ET3010`, `ET3030`, `ET3040`, `ET3050`, `ET3060` and `ET3070` now throw while the directive is constructed, on the template's stack, instead of once per element after the first render.
