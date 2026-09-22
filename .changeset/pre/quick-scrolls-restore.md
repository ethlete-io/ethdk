---
'@ethlete/core': patch
---

Fix `setupScrollRestoration` scrolling to top only after the new route had already painted under zoneless change detection, causing a visible jump from the previous scroll offset on tall pages. It is now driven synchronously off `router.events` (`NavigationEnd` / `NavigationSkipped`) instead of going through signal interop plus `debounceTime`, so `scrollTop = 0` lands before the first paint of the new route. All existing behavior (query param triggers, fragment scrolling, `routerDisableScrollTop`) is unchanged.
