---
'@ethlete/components': major
---

Grid: `GridDebugComponent` moved out of `GRID_IMPORTS` into `GRID_DEBUG_IMPORTS`, so the development-only overlay no longer ships in production bundles. Import that barrel where you use `<et-grid-debug />`.
