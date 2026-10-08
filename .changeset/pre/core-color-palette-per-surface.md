---
'@ethlete/core': minor
---

`provideColorPalette` also takes one list per registered surface theme name plus a `default` list. The new `injectSurfaceColorPalette()` returns a signal of the list for the surface the caller sits on. `injectColorPalette()` returns the `default` list.
