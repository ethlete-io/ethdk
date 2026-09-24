---
'@ethlete/components': patch
---

`et-grid-debug` styles itself through classes in its own stylesheet instead of static `style` attributes, which a strict `style-src` blocked.
