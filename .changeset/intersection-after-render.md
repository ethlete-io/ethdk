---
'@ethlete/core': patch
---

`signalElementIntersection` now takes its first reading after render instead of before layout, and a `rootMargin` or `threshold` signal re-creates the observer when it changes.
