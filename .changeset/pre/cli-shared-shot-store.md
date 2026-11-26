---
'@ethlete/cli': patch
'ethlete-studio': none
---

Design servers of checkouts that share a `node_modules` now share one shot store, so a part picture whose read files are unchanged is drawn once, not once per checkout.
