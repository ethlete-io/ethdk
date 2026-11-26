---
'@ethlete/components': patch
---

Fix the carousel autoplay advancing at once when `duration` is NaN, Infinity or longer than the timer limit. Autoplay now treats such a duration as no duration.
