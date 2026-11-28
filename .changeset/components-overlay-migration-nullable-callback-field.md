---
'@ethlete/components': patch
---

The overlay-and-column-api migration now rewrites a `T | null` callback field that an `afterClosed` result is forwarded to, instead of leaving a type error.
