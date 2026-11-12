---
'@ethlete/cli': patch
---

The design server no longer writes its crash log into a removed checkout. That write recreated the checkout, so its resident design process never saw the checkout gone and stayed alive.
