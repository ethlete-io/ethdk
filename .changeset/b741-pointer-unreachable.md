---
'@ethlete/cli': patch
---

The pointer-focus probe of `design actions` and `design check` skips an element no pointer reaches (computed `pointer-events: none`, as a button in a scaled preview), instead of failing after a 15 s click timeout.
