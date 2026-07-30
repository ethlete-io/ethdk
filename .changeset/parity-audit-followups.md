---
'@ethlete/components': minor
'@ethlete/core': minor
---

Card presets and a tabs variant: `et-radio` and `et-choice-field` take `variant="card"` (full-width clickable
panel, label leading, selection on the border), and `et-segmented-button-group` takes `variant="tabs"` (underlined
selection instead of a filled pill). Closes the last cdk parity gaps.

`@ethlete/core` adds `injectRouterNavigationState<T>()` for reading the state a navigation was given.
