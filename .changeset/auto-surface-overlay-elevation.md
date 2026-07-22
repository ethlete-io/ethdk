---
'@ethlete/core': patch
'@ethlete/components': patch
---

`etAutoSurface` now elevates correctly for content rendered inside an overlay. Projected/portaled content keeps the injector of where it was *declared* (the trigger location), not the pane it renders into, so an `etAutoSurface` inside a select body, menu, date-picker, etc. resolved its parent surface from the outer trigger context and came out one elevation too low — the same level as the overlay's own panel instead of one above it.

`AutoSurfaceDirective` now also consults the root surface-context tracker (which records the innermost open overlay's surface across the portal boundary) and takes whichever parent surface sits higher.

Overlay panels that are themselves the overlay's surface (menu, select/date/cascader panels, tooltip, toggletip, rich-text-editor popups) mark themselves with `AutoSurfaceDirective.matchOverlaySurface()`. They now paint the overlay's registered elevation from the tracker *exactly* — the single source of truth — instead of re-deriving it from their declaration injector and stacking a level above. This fixes a double-elevation: when the trigger itself sat on a raised surface, the panel resolved one level higher than its own overlay pane (e.g. a select body rendering `dark-elevated-2` inside a `dark-elevated` pane, which also pushed avatars/content inside it a level too low). Tooltip, toggletip and the rich-text-editor popups no longer thread surface context through bespoke inputs/sync — every overlay surface now goes through the one tracker-based path.
