---
'@ethlete/components': patch
---

Overlay routing: support routes that nest their own `et-overlay-header`/`et-overlay-body`/`et-overlay-footer` (a full `et-overlay-main`) directly inside the router outlet, without a shared shell or sidebar. Previously the active route grew past the overlay, pushing the footer off-screen and preventing the body from scrolling.

- The router-outlet content wrapper now propagates a bounded height, so each route's body scrolls with its header and footer pinned. Combine with a fixed dialog height to keep a stable size across navigation.
- On navigation, focus now moves to the first sensible element of the new page (first-tabbable, so buttons/inputs win over headings), mirroring the overlay's open-time `autoFocus` behaviour and respecting the configured `autoFocus` (including `false`). It falls back to the page container when the page has nothing tabbable.
- Removed the stray focus outline that appeared around the whole modal on window blur/refocus, caused by the programmatically focused page container.
