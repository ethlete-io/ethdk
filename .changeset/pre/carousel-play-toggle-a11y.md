---
'@ethlete/components': patch
---

Carousel: the play toggle drops its contradicting `aria-pressed` and is `aria-disabled` under reduced motion, and `<et-carousel>` without autoplay no longer runs an IntersectionObserver.
