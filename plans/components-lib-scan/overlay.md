# overlay scan - open findings

Scan of `libs/components/src/lib/overlay/` from 2026-09-28. 0 High, 0 Medium (1 fixed: `syncUrl` deep-link claim dropped in 772d67f5b), 1 Low (7 fixed: backdrop scrim token 7575a109e, positioning inputs documented in efce4e0a6, query-param model writes replace the history entry in 8a8bf2aae, anchored `size`/`arrow`/`hide` middleware opt-in per consumer in 38198384e, a vetoed browser step undone instead of pushed in the router, plain `open` anchors to an `Event` origin, the scroll blocker locks the overlay's own window), 4 Spec (after verification). Skipped: stories, the CSS beyond layer and colour checks. `anchored.strategy.ts`, `full-screen.strategy.ts` and `fullscreen-animation.ts` were read in a second pass (see the last section). Focus trap, focus restore and outside-pointer logic live in `@ethlete/core`'s overlay runtime and are out of scope.

## Spec gaps

- Spec: no test for `hide()` under a vetoing guard (`headless/overlay.directive.spec.ts`). S
- Spec: no test for drag-to-dismiss with a vetoing close guard (`strategies/overlay-drag-to-dismiss.spec.ts`, `utils/overlay-unsaved-changes-guard.spec.ts`). S
- Spec: no spec for the query-param opener's URL/guard interplay (`overlay-opener.spec.ts`). M

## strategies and fullscreen animation (second pass)

- Low: `strategies/index.ts:6` re-exports all of `fullscreen-animation.ts` as public API, which includes `ViewportTransformData`, `cleanupFullscreenAnimationStyles` and the start, leave and abort functions that only `full-screen.strategy.ts` calls. Export the module by name from `full-screen.strategy.ts` only. S
- Spec: no spec for `fullscreen-animation.ts` or `full-screen.strategy.ts` (close during the enter frame, breakpoint switch away and back, a detached origin at close, the shared hidden count). M
