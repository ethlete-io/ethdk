---
status: accepted
open: none
decided: 2026-10-31
source: the decisions-latest log of the parallel backlog (deleted in B597, ADR 0369), "Surfaces follow the elevation system, not picked names" (Q203-Q206), colour follows the same rule
---

# Colour follows the theme-scope rule too

`etProvideColor` sets the active colour theme and children inherit it; parts read only `--et-theme-color-*` and set
no `et-color--<name>`. A semantic colour goes by theme type, never by name. The auto-surface resolver applies the
new surface's `colorThemeVariants` swap, and `DENIED-CLASS` later denies `et-color--*` in parts too.
