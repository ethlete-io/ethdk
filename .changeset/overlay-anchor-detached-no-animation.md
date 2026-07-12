---
'@ethlete/core': patch
---

Overlay: anchored overlays (tooltip, menu, toggletip, …) using
`autoCloseIfReferenceHidden` now tear down instantly when their reference
element disappears, instead of snapping the pane to the viewport's top-left
corner and playing a leave animation from there. Detachment is detected before
any position is applied, so the pane never jumps, and the close skips the leave
transition since there is nothing left to animate against.
