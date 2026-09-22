---
'@ethlete/components': minor
---

Add `createOverlayUnsavedChangesGuard` - the overlay flavor of the `unsavedChanges` family. Called from an overlay content component's injection context, it injects the current `OVERLAY_REF` and vetoes a dismissal (outside pointer, escape, drag, or a programmatic `close()`) while the watched form has unsaved changes, runs the `confirm`, and only then re-issues the close. Per-source opt-out via `dismissSources`, honors `disableClose`, and auto-cleans up on injector destroy.

Also exposes the underlying close-veto seam on `OverlayRef`: `registerCloseGuard(guard)` and `forceClose(source?, result?)`.
