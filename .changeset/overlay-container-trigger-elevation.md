---
'@ethlete/components': patch
---

Overlays now elevate one level above the surface their **trigger** actually sits on, resolved from the trigger's nearest surface ancestor in the DOM rather than from dependency injection. The overlay container previously read its parent surface from the injector context (`SURFACE_PROVIDER`), which is wrong across the portal boundary: an overlay's trigger keeps the injector of where it was *declared*, and the anchored panel overlays (select, cascader, date-picker, menu) mount with no DI link to the trigger at all — so they always landed at elevation 1.

This fixes two cases:

- A `select` (or any anchored panel) opened from **inside a dialog** now mounts at elevation 2 instead of matching the dialog's elevation 1.
- A picker anchored to a field inside an **elevated card** (e.g. a date input in a card at elevation 1) now elevates above the card instead of staying at elevation 1.

Nested content (submenus elevating above their parent menu) and the plain non-nested case (an overlay opened from the base page mounts at elevation 1) are unchanged. Modal dialogs still always mount at elevation 1 — a backdrop resets the visual context.
