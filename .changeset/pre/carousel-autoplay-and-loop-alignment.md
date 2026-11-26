---
'@ethlete/components': patch
---

Carousel: `playOnInit="false"` is honoured, a looping carousel that gets layout late is still moved off its clones, and the play/pause control's icon, label and `aria-pressed` all follow whether autoplay is actually running.
