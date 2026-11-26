---
'@ethlete/core': minor
---

`[etProvideColor]="'surface'"` renders a component in the ambient surface's neutral instead of an accent. **Breaking:** `SurfaceTheme['interactionColor']` is now a swatch - run `nx g @ethlete/core:migrate-surface-interaction-swatch`, then regenerate.
