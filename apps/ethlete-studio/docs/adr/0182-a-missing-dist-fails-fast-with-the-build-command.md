---
status: accepted
open: B351
decided: 2026-11-04
source: grill session 2026-11-04, finding 410
---

# A missing dist fails fast with the build command

When `render.packages` maps a package to a `dist` folder that does not exist, the design server fails at once with an
error that names the package and the build command (for example "`dist/libs/core` missing, run `nx build core`"). It
does not wait, and it does not start the build itself. One check per package, not per module.

This applies only to a checkout whose config maps to its own `dist` (the SDK repo). An installed Studio resolves
`@ethlete/*` from `node_modules` and never sees this error. Tom: "das ist dann nur für studio serve relevant oder? also
wenn ich studio nachher installiere dann sollte das kein fehler sein".

Queue (Tom, same round): B351 right after B343; B317 and B350 after B345/B346.
