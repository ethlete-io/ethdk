---
'@ethlete/query': minor
---

`querySequence` now reports `completed()` and `progress()` (`0`-`100`), so a waterfall can drive a
progress bar or a determinate button spinner without deriving it from `currentStep()`.
