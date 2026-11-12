---
'@ethlete/cli': patch
---

The design shot store writes no picture and takes no draw lock once its checkout is removed. Those writes recreated the checkout, so its resident design process never saw the checkout gone.
