---
'@ethlete/core': patch
---

`signalElementDimensions` now accepts a `viewChild.required(...)`. Before, it read the element while the component was created and threw NG0951.
