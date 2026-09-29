---
'@ethlete/core': patch
---

`fromNextFrame()` now cancels its animation frames on unsubscribe, so an animated lifecycle destroyed mid-transition (e.g. an open menu when its page goes away) leaves no frame pending; `nextFrame()` returns a cancel function.
