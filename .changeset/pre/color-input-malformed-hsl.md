---
'@ethlete/components': patch
---

Color input rejects HSL values with malformed numbers such as `hsl(0 1.2.3% 50%)` instead of emitting `#NaNNaNNaN`.
