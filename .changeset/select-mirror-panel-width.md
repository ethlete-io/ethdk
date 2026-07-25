---
'@ethlete/components': patch
---

Fix `et-select` not forwarding the headless `mirrorPanelWidth` input, which made the
documented escape hatch for compact triggers unreachable from the default component.
With `[mirrorPanelWidth]="false"` the panel sizes to its own content (capped at
`min(400px, 100vw - 24px)`) instead of the field's width — needed whenever the trigger
is narrower than an option row, e.g. a page-size select where the value plus the
selected-check indicator no longer fit and the label was squeezed to a few pixels.
