---
'@ethlete/core': minor
---

`unsavedChanges`: a tracker now locks the browser tab while the value differs from its baseline - a
`beforeunload` listener attached only while changes exist - through the new `tab` option (`false` opts
out), with opt-in `titleMarker`, `flash`, `favicon` and `badge` extras.
`createUnsavedChangesTabLock()` is the same guard standalone, for state that isn't a form.

- New `injectUnsavedChangesCoordinator()`: one confirm on screen at a time app-wide, plus
  `abandonAll(reason?)` for a session that ends underneath a guard. `confirm` now receives a
  `{ signal }` argument so a dialog can close itself instead of being stranded.
- New favicon store and `applyFaviconOverlay(binding)`, plus title-store `addMarker` / `removeMarker`
  behind the public `applyHeadTitleMarker(binding)`.
