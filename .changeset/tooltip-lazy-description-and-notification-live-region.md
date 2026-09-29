---
'@ethlete/components': patch
---

Create the tooltip's hidden description element on first show instead of on construction, so tooltips that never open add no node to `document.body`.
