---
'@ethlete/cli': patch
---

A shot no longer waits forever for a page that stays busy after its last draw: the page closes once parking it outlasts
the draw timeout, and the shot draws on a new page.
