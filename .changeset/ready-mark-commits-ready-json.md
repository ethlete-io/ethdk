---
'@ethlete/cli': patch
---

`et design ready` commits the product's `ready.json` alone after it writes the mark, so a checkout switch cannot drop it. When git refuses the commit, the mark stays written and the command warns `READY UNCOMMITTED`.
