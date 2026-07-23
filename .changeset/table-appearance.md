---
'@ethlete/components': minor
---

Table: `appearance` and `density` inputs. `appearance` picks the frame —
`'enclosed'` (new default: a bordered, rounded surface panel with a tinted header
band), `'divided'`, `'zebra'`, `'grid'`, `'bare'`; `density` sets the cell padding
(`'comfortable'` default, `'compact'`, `'spacious'`). The table is now its own
scroll container — give it a bounded height for a scrolling body with a pinned
header instead of wrapping it in a scroller.
