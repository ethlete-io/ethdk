---
'@ethlete/components': patch
---

Clamp `minuteStep`/`secondStep` on the time picker and the date/time inputs, plus the
calendar's `monthsShown`, through one shared positive-integer transform. A step of `0` or
a negative no longer freezes the picker with a `RangeError`.
