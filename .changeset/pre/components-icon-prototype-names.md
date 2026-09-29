---
'@ethlete/components': patch
---

`etIcon` reports an icon named after an `Object.prototype` member (e.g. `constructor`) as not found instead of throwing a `TypeError`, and `provideIcons` no longer rejects such names as duplicates.
