# 01 — Touch & gesture overhaul

Make sheet drag-to-dismiss feel native on mobile: the exit/snap-back animation
carries the momentum of the swipe instead of playing a fixed-duration
transition, plus the surrounding touch-quality fixes (pointer events, commit
threshold, `touch-action`, `overscroll-behavior`, tap highlight) and sheet
snap points. This is the highest-priority plan (explicit user request).

## Current mechanics (verified 2026-07-30)

- `libs/core/src/lib/utils/swipe.ts:40-97` — `createSwipeTracker` computes
  velocity as whole-gesture average (`movement / (now - startTime)`). A slow
  drag ending in a flick under-reports; real flick detection needs a trailing
  sample window.
- `libs/components/src/lib/overlay/strategies/overlay-drag-to-dismiss.ts:51-108`
  — `defaultSwipeEndStyleInterpolator`: snap-back only when distance **and**
  velocity are under threshold (defaults 150 px / 150 px/s,
  `overlay-strategy.types.ts:95-105`), so flick-dismiss already works. But:
  - Snap-back is fixed `transform 100ms var(--ease-out-1)` regardless of
    remaining distance or release velocity (also `cancelDrag()`, lines 177-188).
  - Dismiss returns `null` → handler calls `overlayRef.closeVia('drag')`
    (line 292) and the exit is the CSS class transition in
    `overlay-container.component.css:401-417` (and mirrors for top/left/right):
    fixed `transform 150ms var(--ease-in-5)` to `translateY(100%) !important`.
    Position is continuous (inline transform from the drag remains as the
    transition start) but duration/easing never reflect gesture speed.
  - **No channel** exists to pass release velocity from the drag handler into
    `lifecycle.leave()` / `OverlayStrategyContext`
    (`sheet-strategy-hooks.ts`, `overlay-strategy-controller.ts` ~249-261).
- Drag-to-dismiss is the only gesture surface on legacy touch/mouse events
  (`isTouchEvent` char-check, duplicated `getClientXY`). Everything else uses
  Pointer Events: `core/drag-handle/drag-gesture.ts` (8 px `commitThreshold`,
  `setPointerCapture`), slider, carousel settle, scrollable snap.
- No commit threshold on touch: first `touchmove` after `touchstart`
  immediately `preventDefault()`s (lines 226-266) — can hijack an intended
  page scroll. `shouldCancelDragForScrollableElement` (131-144) only yields to
  scrollable ancestors.
- No `touch-action` on the sheet container; `user-select` lock
  (`lockSelection`, 159-169) only fires on the mouse path.

## Design

### Phase 1 — velocity model in core

1. Extend `createSwipeTracker` (or replace it during the pointer-events port)
   to keep a ring buffer of recent `{t, x, y}` samples in `update()` and derive
   release velocity from the last ~100 ms in `end()`. Keep the whole-gesture
   average available if anything else consumes it (grep first — likely only
   drag-to-dismiss).
2. Unit-test the window math in core (slow-then-flick, flick-then-hold-still →
   velocity ≈ 0 on release after a pause).

### Phase 2 — pointer events + commit threshold

Port `overlay-drag-to-dismiss.ts` onto the `drag-gesture.ts` pattern:
`pointerdown/move/up` + `setPointerCapture`, 8 px commit threshold before the
sheet starts tracking the finger (matches core), single code path for
touch/pen/mouse. Apply the `user-select` lock on commit for all pointer types.
Declarative `touch-action` on the dismissable container per
`config.direction`: `pan-x` for vertical dismissal, `pan-y` for horizontal
(keep the non-passive `preventDefault` only if testing shows browsers that
still need it after `touch-action` is set — likely removable).

### Phase 3 — momentum handoff

1. **Snap-back**: compute duration from `remainingDistance / releaseVelocity`,
   clamped (~100–350 ms), with a decelerating ease; velocity below a floor
   falls back to today's constant. Optionally a spring via WAAPI keyframes —
   start with dynamic-duration + easing, spring only if it doesn't feel right
   in device testing.
2. **Dismiss**: add a velocity channel from the drag handler into the leave
   lifecycle. Concretely: drag handler stamps release velocity + current
   offset on the strategy context (new field on `OverlayStrategyContext` or a
   `closeVia('drag', meta)` payload); the sheet leave hook sets an inline
   `transition-duration` (computed `remainingDistance / velocity`, clamped)
   before the `et-animation-leave-*` class swap — or replaces the CSS
   transition with an `element.animate()` call for full easing control. Mind
   the existing `!important` on `.et-animation-leave-to`.
3. Respect `prefers-reduced-motion`: keep instant/short exits, no springs.

### Phase 4 — snap points

Add `snapPoints?: number[]` (fractions of the dismiss axis, e.g.
`[0, 0.5]`; `0` = fully open) to `OverlayDragToDismissConfig`
(`overlay-strategy.types.ts:89-106`). On release, pick the target by
**velocity direction first** (a flick advances to the next point in the flick
direction), else nearest point; past the last point → dismiss. The Phase 3
momentum animation moves to the chosen point. Content sizing/overflow at
partial heights is the strategy consumer's concern — document that. RTL note:
snap axis follows the resolved dismiss direction from
`02-consistency-fixes.md` (land that fix inside this plan if done together).

### Phase 5 — surrounding touch quality

- `overscroll-behavior: contain` on `.et-overlay-body`
  (`overlay-container.component.css:270-325`) and
  `scrollable.component.css` — menu/select/cascader/RTE-popup already do this.
- `-webkit-tap-highlight-color: transparent` for interactive components —
  set on the components' interactive base rules (button, chip, menu item,
  option, calendar cell, carousel controls), inside `@layer components`.
- Tooltip touch handling: `tooltip.directive.ts:188-222` is
  mouse-events-only. Switch to pointer events and ignore `pointerType ===
'touch'` for open (tooltips are hover affordances; toggletip covers touch),
  and close any open tooltip on `pointerdown` elsewhere so nothing sticks.
- Touch-target audit fixes where cheap and non-breaking visually: extend hit
  areas via pseudo-element/padding rather than growing visuals — slider thumb
  (18 px visual / 28 px row today), rating icons (24 px), checkbox/radio
  (20 px box). Aim ≥ 44 px hit area on touch-primary layouts; document any
  deliberate exceptions (xs/sm buttons).

## Out of scope

Haptics (`navigator.vibrate`) — note in findings §5. `useCursorDragScroll`
pointer-events port — separate cheap task if wanted; touch fallback is native
scroll, acceptable.

## Verification

`verify-in-storybook` for regression on all four sheet directions +
drag-to-dismiss stories; `verify-in-mobile-emulator` / `verify-on-apple-devices`
for the feel of momentum, snap points, scroll-vs-drag disambiguation, and
overscroll containment — this plan is exactly the case where headless Chromium
isn't enough. Test: drag slowly past threshold (should exit gently), flick
hard (should exit fast), flick opposite direction from a snap point, start a
scroll gesture on sheet content.

Docs: overlays guide (drag-to-dismiss + snap points section). Changesets:
`@ethlete/core` (swipe/velocity) + `@ethlete/components`.
