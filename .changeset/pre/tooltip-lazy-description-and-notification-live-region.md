---
'@ethlete/components': patch
---

Create the tooltip's hidden description element when the tooltip first has text, not on construction, so tooltips without text add no node to `document.body`.
