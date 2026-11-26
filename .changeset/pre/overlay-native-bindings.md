---
'@ethlete/components': major
'@ethlete/core': major
---

Overlay: replace the `inputBindings` / `outputBindings` config objects with a
single `bindings` array using Angular's native binding API. Bind overlay
component inputs, outputs, and two-way models with `inputBinding`,
`outputBinding`, and `twoWayBinding` from `@angular/core`.