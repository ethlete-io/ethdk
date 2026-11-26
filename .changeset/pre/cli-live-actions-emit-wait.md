---
'@ethlete/cli': patch
---

`design actions --live` ends its wait after a press as soon as the declared output fired or the page went quiet, instead of always waiting 400 ms.
