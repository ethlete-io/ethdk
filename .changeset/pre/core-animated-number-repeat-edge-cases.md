---
'@ethlete/core': patch
---

`signalAnimatedNumber` with `duration: 0` now jumps to the target instead of setting `NaN`, and a first frame stamped before `play()` no longer moves the value backwards. `*etRepeat` with a non-numeric count now renders nothing instead of keeping the previous views.
