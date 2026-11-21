---
'@ethlete/cli': patch
---

`design check` no longer caches or reuses the render result of a state that did not draw, so a fixed import draws again instead of repeating the old failure.
