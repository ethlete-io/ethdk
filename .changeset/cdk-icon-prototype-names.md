---
'@ethlete/cdk': patch
---

`etIcon` reports an icon named after an `Object.prototype` member (e.g. `constructor`) as not found instead of throwing a `TypeError`, and the not-found error prints the icon name.
