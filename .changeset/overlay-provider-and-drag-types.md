---
'@ethlete/components': patch
---

`provideOverlayRouter`, `provideOverlayRouterConfig`, `provideSidebarOverlay` and `provideSidebarOverlayConfig` return `StaticProvider[]`, so you can spread them into an overlay's `providers`. `enableDragToDismiss` accepts a typed `OverlayRef`. It needs only `closeVia` and `afterClosed`.
