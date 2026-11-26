---
'@ethlete/cli': patch
---

The design contrast check measures text against a `z-index: -1` fill behind it (a positioned sibling or a `::before`/`::after`) instead of the panel under that fill.
