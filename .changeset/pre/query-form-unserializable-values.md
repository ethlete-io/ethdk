---
'@ethlete/query': patch
---

A query form now commits `undefined`, `NaN` or an invalid `Date` as the field default, and reads a repeated or non-finite URL param for a single-value field as the default.
