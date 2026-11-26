---
'@ethlete/cli': patch
---

`et design shot --crop` with a box outside the content writes an empty transparent picture and prints a note with the content box, instead of failing with "the screenshot failed".
