---
'@ethlete/components': minor
---

Table: `virtualScroll` renders only the rows near the viewport (with
`estimateRowHeight` and `overscan` tuning), so very long lists stay fast. The
table becomes its own scroll container when enabled; the sticky header and row
expansion still work.
