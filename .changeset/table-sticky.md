---
'@ethlete/components': minor
---

Table: pinned columns and a sticky footer. `sticky: 'start' | 'end'` on a column
def keeps it in view while the table scrolls horizontally; a column `footerCell`
(context: the rendered rows) renders a summary row pinned to the bottom of the
scroll viewport. Both compose with grouping, virtualization and the other features.
