---
'@ethlete/components': patch
---

Command palette: the search field reports `aria-expanded="false"` and drops `aria-controls` while the query matches nothing, instead of pointing at a list that is not rendered.
