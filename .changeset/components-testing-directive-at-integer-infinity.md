---
'@ethlete/components': patch
---

`directiveAt` from `@ethlete/components/testing` now throws an error naming the selector when nothing in the fixture matches it, instead of a null-property error. `monthsShown` and `minuteStep` now fall back to 1 for `Infinity`, as they already did for zero, negatives and unparseable values.
