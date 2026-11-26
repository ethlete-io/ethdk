---
'@ethlete/core': minor
---

Add the `unsavedChanges` family for guarding forms against accidental discard, and a close-veto seam in the overlay runtime that powers it.

- `createUnsavedChangesTracker` - snapshots a default value, tracks whether the watched form/value differs from it (deep-equal snapshot semantics, not signal-forms `dirty()`), and normalizes an async `confirm` (value / Promise / Observable) to a `Promise<boolean>`. Signal-forms `FieldTree` is the first-class source; `Signal<FieldTree | null>` (late/async forms), `AbstractControl` (migration), and `WritableSignal` (escape hatch) are also supported. Includes `refreshDefaultValue` (re-baseline after a save-and-keep-open) and `restoreDefaultValue`.
- `createUnsavedChangesGuard` - the router/manual flavor, adding a `canDeactivate` bridge for Angular route guards.
- Overlay runtime: `overlayRef.registerCloseGuard(guard)` (synchronous veto for pending closes, returns an unregister fn) and `overlayRef.forceClose(result?, source?)` (commit a close bypassing guards). `reference-detached` closes always bypass guards. This is the seam `createOverlayUnsavedChangesGuard` in `@ethlete/components` builds on.
