---
'@ethlete/cli': patch
---

`et design` runs a call in its own process when the resident design process stays busy for more than 5 s (`ETHLETE_DESIGN_BUSY_WAIT_S` changes the wait), instead of queueing behind it.
