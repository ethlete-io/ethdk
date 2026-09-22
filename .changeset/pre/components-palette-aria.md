---
'@ethlete/components': patch
---

Command palette: the search field drops `aria-controls` and reports `aria-expanded="false"` with no results, and `etCommandPaletteShortcut` closes a palette opened through `injectCommandPalette()` instead of stacking one.
