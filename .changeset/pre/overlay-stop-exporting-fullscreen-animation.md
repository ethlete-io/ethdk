---
'@ethlete/components': major
---

Breaking: stop exporting the overlay full-screen animation internals (`startFullscreenEnterAnimation`, `startFullscreenLeaveAnimation`, `cleanupFullscreenAnimation`, `cleanupFullscreenAnimationStyles`, `abortFullscreenAnimation` and their state and dependency types). `fullScreenDialogOverlayStrategy` is unchanged. `et update` runs a migration that removes the names from imports and marks their uses.
