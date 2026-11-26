---
'@ethlete/cli': patch
---

`design compare` empties only the `slot()` regions the compared part draws itself, no longer those of the parts it embeds, so a page keeps the content of its shell.
