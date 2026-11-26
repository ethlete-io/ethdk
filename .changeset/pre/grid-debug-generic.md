---
'@ethlete/components': patch
---

Grid: `GridDebugComponent` is generic in the item payload, so `<et-grid-debug>` now accepts a typed
grid instead of only `GridComponent<unknown>`.
