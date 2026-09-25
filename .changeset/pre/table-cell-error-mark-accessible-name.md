---
'@ethlete/components': patch
---

The failed-cell mark of `etTableCellErrorTooltip` now carries its message as its accessible name. It was focusable but `aria-hidden` with no label, because the icon's own bindings overwrote the template's.
