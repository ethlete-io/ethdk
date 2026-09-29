---
'@ethlete/components': major
---

Breaking: stop exporting the grid layout engine internals (collision, geometry, snapping and auto-scroll helpers and their types). `serializeGridLayout`, `deserializeGridLayout`, `SerializeOptions` and `DEFAULT_BREAKPOINTS` stay public. `et update` runs a migration that removes the names from imports and marks their uses.
