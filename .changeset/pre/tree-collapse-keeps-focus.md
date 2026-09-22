---
'@ethlete/components': patch
---

Collapsing a tree branch that holds the focused row now moves focus and the tab stop to the
nearest surviving ancestor instead of dropping them on `<body>` and the first row.
