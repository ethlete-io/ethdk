---
'@ethlete/components': major
---

Breaking: `OverlayRef` no longer exposes `attachRuntime`, `attachComponentInstanceOverride`, `closeVia` or `registerHeaderTemplate`, `createOverlayRef` is no longer exported, and `forceClose` now takes `(result?, source?)` like `close`. Swap the arguments of every `forceClose(source, result)` call.
