---
'@ethlete/components': patch
---

Overlay: the default enter/leave animation CSS now ships with the strategy that uses it
(`stylesComponent` on the breakpoint config), so an app only bundles the animations for the overlay
kinds it opens. Overlays that hand-roll a layout `containerClass` instead of using a built-in
strategy must now provide their own animation CSS.
