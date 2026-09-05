---
'@ethlete/query': patch
---

`defineQueryForm`: two forms writing in one tick keep each other's params, `appendToUrl: false` leaves a foreign param alone, `0` reads back as a number, and a commit no longer cancels a route change.
