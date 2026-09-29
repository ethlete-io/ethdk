---
'@ethlete/components': minor
---

Remove `GridItemRef` and `GridComponentRegistration.configComponent`. The grid never rendered a config component or provided a `GridItemRef`. Build item editing in the app instead, for example from a custom `actionsComponent` that opens your own overlay.
