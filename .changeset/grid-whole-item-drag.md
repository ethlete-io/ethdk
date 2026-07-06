---
'@ethlete/components': minor
---

Grid: in edit mode the whole item is now a drag surface — a pointerdown anywhere on the item content starts a drag, instead of only the drag handle slot. Interactive overlays (the actions slot, resize handles, or anything that stops propagation such as `GridItemToolbarComponent`) still win, and read-only grids keep their content inert. Also fixes the `et-grid--readonly` class never being applied to the grid host, so the intended read-only styles (non-interactive drag handle, hidden resize handles) now take effect, and adds a grab/grabbing cursor on the content while editing.
