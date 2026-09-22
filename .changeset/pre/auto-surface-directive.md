---
'@ethlete/core': minor
'@ethlete/components': patch
---

Theming: add `AutoSurfaceDirective` (`etAutoSurface`), which resolves the surface
theme one elevation above its parent (or an explicitly provided) surface context
and applies it through a host `ProvideSurfaceDirective`. Meant to be used as a
host directive on components that render inside a detached overlay pane, where
surface context can't cascade through the DOM.

Tooltip and toggletip now use `AutoSurfaceDirective` as a host directive instead
of duplicating the auto-surface resolution logic. No change to their rendered
surface.
