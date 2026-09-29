# overlay scan - open findings

Scan of `libs/components/src/lib/overlay/` from 2026-09-28. 0 High, 0 Medium (1 fixed: `syncUrl` deep-link claim dropped in 772d67f5b), 5 Low (3 fixed: positioning inputs documented in efce4e0a6, query-param model writes replace the history entry in 8a8bf2aae, anchored `size`/`arrow`/`hide` middleware opt-in per consumer in 38198384e), 5 Spec (after verification). Skipped: stories, the CSS beyond layer and colour checks. `anchored.strategy.ts`, `full-screen.strategy.ts` and `fullscreen-animation.ts` were read in a second pass (see the last section). Focus trap, focus restore and outside-pointer logic live in `@ethlete/core`'s overlay runtime and are out of scope.

## routing

- Low: a vetoed browser navigation restores the param with a push, not a replace (`routing/overlay-router.ts:478`), so the forward history is lost and `nativeBrowserBackStack` is not updated. S

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

- Low: `strategies/index.ts:6` re-exports all of `fullscreen-animation.ts` as public API, which includes `ViewportTransformData`, `cleanupFullscreenAnimationStyles` and the start, leave and abort functions that only `full-screen.strategy.ts` calls. Export the module by name from `full-screen.strategy.ts` only. S
- Spec: no spec for `fullscreen-animation.ts` or `full-screen.strategy.ts` (close during the enter frame, breakpoint switch away and back, a detached origin at close, the shared hidden count). M
