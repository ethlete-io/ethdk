# overlay scan - open findings

Scan of `libs/components/src/lib/overlay/` from 2026-09-28. 0 High, 1 Medium, 20 Low, 5 Spec (after verification). Skipped: stories, the CSS beyond layer and colour checks. `anchored.strategy.ts`, `full-screen.strategy.ts` and `fullscreen-animation.ts` were read in a second pass (see the last section). Focus trap, focus restore and outside-pointer logic live in `@ethlete/core`'s overlay runtime and are out of scope.

## headless

- Low: all positioning inputs (`placement`, `offset`, `mode`, …) are read once in `mountOverlay` (`headless/overlay.directive.ts:194-227`). A change while the overlay is open has no effect until the next open. Document it or re-apply the strategy. M
- Low: `OverlayTriggerDirective` sets `aria-expanded` but no `aria-haspopup` or `aria-controls` (`headless/overlay-trigger.directive.ts:9-13`), and it stays clickable and announces `aria-expanded="false"` while the overlay is `disabled`. S

## routing

- Medium: `syncUrl` does not deep-link, although the JSDoc (`routing/overlay-router.ts:74-76`) and `apps/docs/components/overlays.md:422` say it does. The param key comes from a counter (`createComponentId('ovr')`, `:164`), and the constructor overwrites the param with the initial route (`:437`) instead of reading it. Either restore the route from a stable key or drop the deep-link claim. M Verified: `createComponentId` is a module counter, and the effect skips the first param event.
- Low: a vetoed browser navigation restores the param with a push, not a replace (`routing/overlay-router.ts:478`), so the forward history is lost and `nativeBrowserBackStack` is not updated. S
- Low: `OverlayTitleDirective` sets `aria-labelledby` on the host and never removes it (`overlay-title.directive.ts:32-41`). In a routed overlay the first page's title id stays after navigation, so the dialog loses its accessible name once that page leaves the DOM. Update or remove on destroy. S
- Low: inline `styles` not in `@layer components`, with hardcoded `300ms` transitions (`routing/overlay-route-header-template-outlet.component.ts:26-61`, `routing/overlay-shared-route-template-outlet.component.ts:19`). Move to `.css` files inside the layer. S

## openers

- Low: the model-sync effect pushes one history entry per model change (`overlay-opener.ts:265-266,293-299`), so each tab switch inside a query-param overlay costs one Back press. Consider `replaceUrl` for model writes. S
- Low: on opener destroy `openRef.close()` can be vetoed (`overlay-opener.ts:357`), which leaves an overlay nobody manages while the param is already cleared. Use `forceClose` or document it. S

## strategies

- Low: `createOverlayStrategyController` only releases `documentClass`/`bodyClass` and destroys its child injector in `afterClosed` (`strategies/overlay-strategy-controller.ts:427-442`). If `overlayRuntime.mount` throws or the runtime is torn down without a close (app destroy, HMR), the classes (e.g. the full-screen document class) and the breakpoint observers leak. Also tie the cleanup to the runtime's destroy. S Re-rated from Medium: app destroy runs the runtime's `forceTeardown`, which calls `finishClose` and so fires `afterClosed`; the classes are retained in `attach`, after `mount`, so a throwing mount leaks only the child injector and its breakpoint observers.
- Low: the full-screen strategy injects the root `DOCUMENT` (`strategies/full-screen.strategy.ts:49`) and appends the origin clone to its body, while the controller uses the origin's `ownerDocument` (`strategies/overlay-strategy-controller.ts:111`). An overlay opened in a pop-up window animates its clone in the main window. The same applies to the scroll blocker, which only locks the main document (`overlay-scroll-blocker.ts:29`). S
- Low: `resolvePaintedPaneElement` runs `getComputedStyle` on every element of the content (`overlay-container.component.ts:312-314`) on each open that has an arrow or is a sheet. A sheet with a large table forces a full style pass. Stop at a depth or mark the painted pane. S

## cleanup

- Low: hardcoded colours as primary values: `--et-overlay-body-divider-color: #565656` (`overlay-container.component.css:10`), `--_et-overlay-drag-handle-color: #565656` (`strategies/sheet-styles.component.css:6`), `--et-overlay-backdrop-color: rgb(0 0 0 / 0.32)` (`overlay-container.component.css:146`). Resolve from surface tokens with the literal as fallback. S
- Low: comments outside the AGENTS.md allowlist: narration in `overlay-container.component.ts:88-106,148-152,175-184,309-310`, `overlay-ref.ts:28-30,112`, `overlay-opener.ts:281-282,292,311-312,336`, `strategies/overlay-strategy-controller.ts:101,151,166`, `overlay-scroll-blocker.ts:21-22`; JSDoc on non-exported helpers in `overlay-manager.ts:43-58` and on private members in `overlay-container.component.ts:227-246`. S
- Low: the plain `open` path (no `strategies`) ignores an `Event` origin for positioning (`overlay-manager.ts:96-100`) and does not resolve the focused element as origin, unlike `openWithStrategies` (`:144`). The two paths anchor differently for the same config. S

## Spec gaps

- Spec: no test for `hide()` under a vetoing guard (`headless/overlay.directive.spec.ts`). S
- Spec: no test for drag-to-dismiss with a vetoing close guard (`strategies/overlay-drag-to-dismiss.spec.ts`, `utils/overlay-unsaved-changes-guard.spec.ts`). S
- Spec: no spec for `syncUrl` in the overlay router (browser Back/forward, vetoed Back, close cleanup). M
- Spec: no spec for the query-param opener's URL/guard interplay (`overlay-opener.spec.ts`). M

## strategies and fullscreen animation (second pass)

- Low: a close before the first enter frame hides the origin for the whole reduced leave (`strategies/fullscreen-animation.ts:602-611`). In the `init` branch `isOriginHidden` is always `false`, so the `else` hides the origin although no clone replaces it; the trigger blinks out until `onAfterLeave`. Restore only, never hide, in that branch. S
- Low: `cleanupFullscreenAnimation` decides from the shared `data-et-origin-hidden-count` attribute, not from `state.isOriginHidden` (`strategies/fullscreen-animation.ts:683`). When two overlays use the same origin, the first cleanup decrements the other overlay's hide and shows the origin under its open clone. Use `state.isOriginHidden`. S
- Low: `restoreOriginElement` resets the transition in an uncancelled `nextFrame` after it clears the capture attributes (`strategies/fullscreen-animation.ts:382-395`). A hide in that frame captures the temporary `transition: none` as the original (`:62-67`), and the origin keeps an inline `transition: none` after the next close. Clear the attributes inside the frame callback, or cancel the frame on hide. S
- Low: the viewport size comes from `visualViewport` (`strategies/fullscreen-animation.ts:103-114`), but the rect is layout-viewport relative, the container fills the layout viewport and the reduced check reads `documentElement.clientWidth` (`:162`). With pinch zoom or an open soft keyboard the clone and pane grow to a wrong centre and scale. Use the layout viewport for all three. S
- Low: `buildAnchoredRuntimePositionStrategy` always calls `enableAnchoredOverlayPositionExtras()` (`strategies/anchored.strategy.ts:68-69`). Every consumer of tooltip, select, menu or `[etOverlay]` bundles floating-ui `size`, `arrow` and `hide`, so the opt-in split in `@ethlete/core` has no effect through `components`. Call it only from the consumers that use those options, or drop the split. M
- Low: `strategies/index.ts:6` re-exports all of `fullscreen-animation.ts` as public API, which includes `ViewportTransformData`, `cleanupFullscreenAnimationStyles` and the start, leave and abort functions that only `full-screen.strategy.ts` calls. Export the module by name from `full-screen.strategy.ts` only. S
- Low: comments outside the AGENTS.md allowlist in `strategies/fullscreen-animation.ts:241,246` and `strategies/anchored.strategy.ts:68`. The comment at `:246` is also wrong: the percentage is measured from the top-left corner, not from the viewport centre. S
- Spec: no spec for `fullscreen-animation.ts` or `full-screen.strategy.ts` (close during the enter frame, breakpoint switch away and back, a detached origin at close, the shared hidden count). M
