---
'@ethlete/cli': patch
---

`design shot` finishes the transitions of embedded frames before it draws, and draws each state twice: a state whose two renders differ is reported with its changed pixel count and box, and the command exits non-zero.
