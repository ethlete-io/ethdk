---
'@ethlete/components': patch
---

`et-select` closes on Escape again when the panel was reopened while the previous panel was still animating out (for example ArrowDown right after picking an option in an inline search). Before, the Escape was swallowed and the list stayed expanded.
