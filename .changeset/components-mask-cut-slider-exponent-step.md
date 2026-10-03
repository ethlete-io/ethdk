---
'@ethlete/components': patch
---

A masked input no longer deletes a digit next to a cut or dragged-away selection that held only formatting (cutting the `-` in `12-34` kept `134`). A slider whose `step` prints in exponent notation (`1.5e-7`) no longer rounds its values to the wrong number of decimals.
