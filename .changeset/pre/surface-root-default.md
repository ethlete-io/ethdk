---
'@ethlete/core': minor
'@ethlete/components': patch
---

A single-scheme app no longer needs a root `etProvideSurface`: its default surface paints `:root` unconditionally once the surface CSS is regenerated, and the outermost provider resolves it through the new `injectDefaultSurfaceTheme()` / `injectSurfaceType()`.
