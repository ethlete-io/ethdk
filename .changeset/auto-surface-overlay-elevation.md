---
'@ethlete/core': patch
'@ethlete/components': patch
---

`etAutoSurface` now elevates correctly for content rendered inside an overlay. Projected/portaled content keeps the injector of where it was *declared* (the trigger location), not the pane it renders into, so an `etAutoSurface` inside a select body, menu, date-picker, etc. resolved its parent surface from the outer trigger context and came out one elevation too low — the same level as the overlay's own panel instead of one above it.

`AutoSurfaceDirective` now also consults the root surface-context tracker (which records the innermost open overlay's surface across the portal boundary) and takes whichever parent surface sits higher. Overlay panels that are themselves the overlay's surface (menu, select/date/cascader panels, tooltip, toggletip) opt out via the new `AutoSurfaceDirective.ignoreOverlaySurfaceContext()` so they keep adopting their overlay's elevation rather than stacking above it — their rendered surface is unchanged.
