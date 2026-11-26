---
'@ethlete/cli': patch
'ethlete-studio': none
---

Part compare passes a lone pixel over the tolerance on a round edge as anti-alias: none of its 8 neighbours differs, and each picture's value lies inside the other picture's 3x3 range on every channel. A shifted edge still fails.
