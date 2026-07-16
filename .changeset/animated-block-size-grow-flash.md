---
'@ethlete/core': patch
---

`injectAnimatedBlockSize`: growing panels (menu, select) no longer flash at their final size for one frame before the resize animation plays — the animation now starts inside the `ResizeObserver` callback, before the browser paints the new layout.
