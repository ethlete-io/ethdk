---
'@ethlete/components': minor
---

Overlay router: added `registerNavigationGuard(guard)`. It runs before every route change, including browser back and forward, and cancels the navigation when it resolves `false`.
