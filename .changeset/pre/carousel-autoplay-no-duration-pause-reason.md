---
'@ethlete/components': patch
---

Carousel: `pauseReason()` now reports `no-duration` when an `autoplayTime` of `0` keeps autoplay from
running, instead of staying `null`.
