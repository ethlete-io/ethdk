---
'@ethlete/cli': patch
---

`et design check` no longer reports an `rgb()` or `rgba()` as a hard-coded colour when every channel comes from `var()`, for example `rgb(var(--shadow-rgb) / 0.25)`. A literal channel is still reported.
