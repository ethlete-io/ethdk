---
status: accepted
built: a5a004199
decided: 2026-10-27
source: plans/ethlete-studio/design-system/model.md, "Slice 1 decisions (2026-10-27)"
---

# config.json holds products with their render settings

A `products` entry holds the render settings of a project (`styles`, `head`, `providers`, `themes`) plus `base` and
`presets`. The old `projects` key stays readable until slice 2 moves Studio.
