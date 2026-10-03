---
'@ethlete/core': patch
---

`applyFaviconOverlay` loads the base icon with a CORS request, so an overlay now shows over a favicon served from a CORS-enabled CDN instead of being dropped on a tainted canvas.
