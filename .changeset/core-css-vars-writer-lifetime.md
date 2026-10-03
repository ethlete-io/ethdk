---
'@ethlete/core': patch
---

`writeViewportSizeToCssVariables()` and `writeScrollbarSizeToCssVariables()` keep updating their CSS variables after the component that first called them is destroyed. Before, the writer stopped with that component and every later call was skipped.
