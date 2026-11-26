---
'@ethlete/core': major
'@ethlete/components': major
'@ethlete/agent-rules': patch
'ethlete-studio': patch
'timetrack-app': patch
---

`SurfaceInteractiveDirective` (`[etSurfaceInteractive]`) and its `et-surface-interactive` class are removed; `etButton` no longer adds it. The `et-surface-tint` utilities read the surface text color where no theme sets `tint`. `et update` runs `@ethlete/core:migrate-remove-surface-interactive`, which drops the attribute, the class and the imports.
