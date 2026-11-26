---
'@ethlete/components': patch
---

Fix ARIA structures that did not hold: the calendar grid, both scheduler grid views, the
page-sticky table and both tab bars now own their rows, cells and tabs instead of losing them
behind role-less layout wrappers.
