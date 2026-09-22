---
'@ethlete/components': minor
---

Overlay: add `overlayRef.updatePositionStrategy(strategy)` to re-apply positioning with a new strategy without remounting the overlay. Useful for repositioning an open overlay (e.g. moving an anchored menu to a new reference or point). Note that a strategy-controller breakpoint switch will override this with its own strategy again.
