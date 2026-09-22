---
'@ethlete/components': patch
---

Overlay routing: a shell that wraps only the router outlet (each route carries its own `et-overlay-main` with header/body/footer) now reliably bounds the outlet to the pane. The shell content grid pins both axes (`grid-template-columns`/`grid-template-rows: minmax(0, 1fr)`), so the outlet fills a fixed-height dialog and the routed page's body scrolls with its header and footer pinned - instead of the whole overlay scrolling. The `minmax(0, ...)` column also stops a wide child (e.g. a rich-text editor) from blowing the grid past the pane width.
