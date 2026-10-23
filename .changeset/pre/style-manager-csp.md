---
'@ethlete/core': patch
---

The style manager hides its container with the `hidden` attribute instead of an inline style, so server-rendered pages pass a CSP without `'unsafe-inline'` for style attributes.
