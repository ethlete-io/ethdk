---
'@ethlete/core': minor
'@ethlete/components': patch
---

Add `injectAnimatedBlockSize` — a core util that smoothly animates an element's `block-size` as its
content resizes (baseline captured on first render so the initial layout never plays as a
grow-from-0, interruption-safe, respects `prefers-reduced-motion`). `et-menu` and the rich text
editor's trigger popup now share it, giving a more consistent, smoother resize.
