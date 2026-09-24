---
'@ethlete/core': patch
---

The legacy theme stylesheets carry the page's `ngCspNonce`, and `et-structured-data` no longer writes a static `style` attribute, so both pass a strict `style-src`.
