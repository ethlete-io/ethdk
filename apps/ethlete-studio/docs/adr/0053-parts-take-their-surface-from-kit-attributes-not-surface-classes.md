---
status: accepted
built: 0fd557da5
decided: 2026-10-31
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Surfaces follow the elevation system, not picked names" (Q203-Q206) item 1
---

# Parts take their surface from kit attributes, not surface classes

Tom: an auto surface picks the next higher surface, so everything that floats takes its surface and colours from the
theme; no part names a theme. `data-et-auto-surface` sets the theme of elevation + 1 like `etAutoSurface`, and
`data-et-surface-interactive` loads the SDK interactive surface CSS like `etSurfaceInteractive`; `et design task`
maps them 1:1. Only the root surface is fixed, by the frame or the app root.
