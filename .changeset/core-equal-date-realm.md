---
'@ethlete/core': patch
---

`equal()` now compares `Date`s by tag instead of constructor identity, so a faked or cross-realm `Date` no longer compares equal to a different one.
