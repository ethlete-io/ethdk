---
'@ethlete/cdk': patch
---

The icon directive and masonry items set their host styles through style bindings instead of a static `style` attribute, which a strict `style-src` blocked.
