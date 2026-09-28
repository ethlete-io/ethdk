# overlay scan - open findings

Scan of `libs/components/src/lib/overlay/` from 2026-09-28. 0 High, 1 Medium, 8 Low, 5 Spec (after verification). Skipped: stories, the CSS beyond layer and colour checks. `anchored.strategy.ts`, `full-screen.strategy.ts` and `fullscreen-animation.ts` were read in a second pass (see the last section). Focus trap, focus restore and outside-pointer logic live in `@ethlete/core`'s overlay runtime and are out of scope.

## headless

- Low: all positioning inputs (`placement`, `offset`, `mode`, …) are read once in `mountOverlay` (`headless/overlay.directive.ts:194-227`). A change while the overlay is open has no effect until the next open. Document it or re-apply the strategy. M

## routing

- Medium: `syncUrl` does not deep-link, although the JSDoc (`routing/overlay-router.ts:74-76`) and `apps/docs/components/overlays.md:422` say it does. The param key comes from a counter (`createComponentId('ovr')`, `:164`), and the constructor overwrites the param with the initial route (`:437`) instead of reading it. Either restore the route from a stable key or drop the deep-link claim. M Verified: `createComponentId` is a module counter, and the effect skips the first param event.
- Low: a vetoed browser navigation restores the param with a push, not a replace (`routing/overlay-router.ts:478`), so the forward history is lost and `nativeBrowserBackStack` is not updated. S

## openers

- Low: the model-sync effect pushes one history entry per model change (`overlay-opener.ts:265-266,293-299`), so each tab switch inside a query-param overlay costs one Back press. Consider `replaceUrl` for model writes. S

## strategies

- Low: the scroll blocker only locks the main document (`overlay-scroll-blocker.ts`), so a modal opened in a pop-up window does not lock that window. S

## cleanup

- Low: hardcoded backdrop colour `--et-overlay-backdrop-color: rgb(0 0 0 / 0.32)` (`overlay-container.component.css`). No surface or scrim token fits a black scrim; mapping it is a design call. S
- Low: the plain `open` path (no `strategies`) ignores an `Event` origin for positioning (`overlay-manager.ts:96-100`) and does not resolve the focused element as origin, unlike `openWithStrategies` (`:144`). The two paths anchor differently for the same config. S

## Spec gaps

- Spec: no test for `hide()` under a vetoing guard (`headless/overlay.directive.spec.ts`). S
- Spec: no test for drag-to-dismiss with a vetoing close guard (`strategies/overlay-drag-to-dismiss.spec.ts`, `utils/overlay-unsaved-changes-guard.spec.ts`). S
- Spec: no spec for `syncUrl` in the overlay router (browser Back/forward, vetoed Back, close cleanup). M
- Spec: no spec for the query-param opener's URL/guard interplay (`overlay-opener.spec.ts`). M

## strategies and fullscreen animation (second pass)

- Low: `buildAnchoredRuntimePositionStrategy` always calls `enableAnchoredOverlayPositionExtras()` (`strategies/anchored.strategy.ts:68-69`). Every consumer of tooltip, select, menu or `[etOverlay]` bundles floating-ui `size`, `arrow` and `hide`, so the opt-in split in `@ethlete/core` has no effect through `components`. Call it only from the consumers that use those options, or drop the split. M
- Low: `strategies/index.ts:6` re-exports all of `fullscreen-animation.ts` as public API, which includes `ViewportTransformData`, `cleanupFullscreenAnimationStyles` and the start, leave and abort functions that only `full-screen.strategy.ts` calls. Export the module by name from `full-screen.strategy.ts` only. S
- Spec: no spec for `fullscreen-animation.ts` or `full-screen.strategy.ts` (close during the enter frame, breakpoint switch away and back, a detached origin at close, the shared hidden count). M
