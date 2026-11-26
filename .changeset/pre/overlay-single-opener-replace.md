---
'@ethlete/components': minor
'@ethlete/core': minor
---

`createOverlayOpener(definition, { single: 'replace' })` keeps one overlay open and replaces it on the next `open()`, through the unsaved-changes guard (`dismissSources.replace`); share one slot across openers with `createOverlaySingleSlot()`.
