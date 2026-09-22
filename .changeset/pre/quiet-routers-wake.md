---
'@ethlete/core': patch
---

Fix `injectRoute`, `injectUrl` and the `injectRouterState` based signals (`injectPathParams`, `injectQueryParams`, `injectRouteData`, etc.) returning the previous route when read synchronously inside a component constructor during navigation. They now read the already committed router state instead of waiting for the `NavigationEnd` event.
