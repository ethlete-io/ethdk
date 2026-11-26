---
'@ethlete/core': minor
---

Overlay: anchored positioning now accepts a `VirtualElement` (from `@floating-ui/dom`) as the `referenceElement`, not just an `HTMLElement`. This makes it possible to anchor an overlay to an arbitrary point or region - for example positioning a context menu at the pointer. When a virtual reference is used, `mirrorWidth` and origin-element based behaviors gracefully fall back since there is no real element to measure.
