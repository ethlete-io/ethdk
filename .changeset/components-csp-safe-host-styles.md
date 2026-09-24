---
'@ethlete/components': patch
---

Icons, tabs, stream players and the color picker area set their host styles through style bindings instead of a static `style` attribute, which a strict `style-src` blocked.
