---
'@ethlete/components': patch
---

The rich text editor test driver's `attachEditable` option now hands the element to `attachEditable()`, so a headless editor under test handles input, paste, keyboard and the other events.
