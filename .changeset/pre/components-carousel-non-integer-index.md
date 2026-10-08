---
'@ethlete/components': patch
---

The carousel's `goTo()` and `activeIndex` now ignore a fractional or `NaN` index instead of leaving the current slide as `NaN`.
