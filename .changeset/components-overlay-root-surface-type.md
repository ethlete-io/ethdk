---
'@ethlete/components': patch
---

An overlay opened where no surface is provided takes the surface type `:root` paints, so an app with a light and a dark default surface gets light overlays in light mode instead of dark ones. An overlay's header or footer no longer widens the pane past its max width when its text cannot wrap.
