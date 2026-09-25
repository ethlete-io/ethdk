---
'@ethlete/components': patch
---

The table's failed-cell icon, drawn when no `etTableCellErrorTooltip` is present, now carries its message as its accessible name. It was `aria-hidden` with no label, because the icon's own bindings overwrote the template's.
