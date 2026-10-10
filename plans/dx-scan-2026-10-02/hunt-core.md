# hunt-core — bug hunt 2026-10-10

Scope: `libs/core/src/lib` (read-only hunt). Findings below were not in `core.md` (CORE-01..18).

Folders picked (source files vs `*.spec.ts`, then checked against `libs/core/src/scenarios`):

- `animations/` (12 src / 2 spec): lifecycle state machine and flip animation carry the most runtime logic. Specs exist for the lifecycle and flip, but not for the force/skip paths' class cleanup.
- `signals/element-*` (observer-backed signals; `element-intersection`, `element-dimensions`, `element-mutations`, `element-children`, `element-scroll-state`, `document-visibility` have no spec of their own): only the scenarios `element-observers` / `element-signals` cover them.
- `scrolling/` + `directives/` (`snap.ts` and `click-outside.directive.ts`; `scroll-observer*` and `restore-scroll` have thin or no coverage).
- `unsaved-changes/` (8 src / 3 spec): tracker, coordinator, tab lock.

Also read and found clean: `resize-handles`, `drag-handle` (teardown, `exhaustMap`, selection suppression, pointer capture all hold), `animated-if`, `animatable`, `flip-animation` (group replay settles correctly), `scroll-observer*`, `restore-scroll`, `injectViewportSize`, `memoizeSignal`, `text-selection`.

| ID    | Sev    | Kind     | Decision | Title                                                                                                              |
| ----- | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| HC-01 | Medium | bug      | no       | `AnimatedLifecycle` force/skip paths leave the opposite `-done`/`-interrupt` classes on the element                |
| HC-02 | Medium | bug      | no       | `getScrollSnapTarget` treats a hidden (zero-rect) item as already aligned and returns `null`                       |
| HC-03 | Low    | bug      | no       | `[etClickOutside]` keeps `pressStartedInside` after a press with no click and swallows the next keyboard click     |
| HC-04 | Low    | bug      | no       | `signalElementIntersection` appends entries out of DOM order when `rootMargin` is non-zero                         |
| HC-05 | Low    | bug      | no       | `isElementVisible().intersectionRatio` is `min(inline, block)`, not an area ratio, so it disagrees with the IO     |
| HC-06 | Low    | bug      | no       | `createUnsavedChangesTracker({ defaultValue: null })` never captures a baseline and is never dirty                 |
| HC-07 | Low    | test-gap | no       | No spec for `getScrollSnapTarget` with a hidden item, scroll-observer directives, or intersection order with margin |

## HC-01 `AnimatedLifecycle` force/skip paths leave the opposite `-done`/`-interrupt` classes on the element

- Where: `libs/core/src/lib/animations/animated-lifecycle.directive.ts:106-114` (instant `enter()`), `:262-276` (`forceEnteredState`), `:278-292` (`forceLeftState`); the skip branches at `:132-143` and `:212-223`.
- Problem: the normal `enter()` removes `leave-done` (`:117`), and the normal `leave()` removes `enter-done` (`:196`). The shortcut paths do not:
  - `forceEnteredState()` removes the `from/active/to` classes of both phases, then adds `enter-done`. It never removes `leave-done`, `leave-interrupt` or `enter-interrupt`. From state `left` (class `leave-done`) it ends with `enter-done` and `leave-done` together. `forceLeftState()` is the mirror and keeps `enter-done`.
  - The instant branch of `enter()` (`skipNextEnter()` true, or `init` before `ngAfterViewInit`) removes nothing: `lifecycle.leave(); lifecycle.skipNextEnter.set(true); lifecycle.enter()` ends `entered` with `leave-active leave-to` still set.
  - The skip branch of `enter()` (`forcedThisFrame`) removes the leave classes but not `leave-done`.
  - Consumers key CSS on those classes. `libs/components/src/lib/overlay/strategies/overlay-origin-clone.component.css:28-50` sets `enter-done` to `opacity: 0` and `leave-done` to `opacity: 1` at equal weight, so with both present the later rule (`leave-done`) wins and the element shows the leave state while `state()` says `entered`.
  - Callers: `fullscreen-animation.ts:476,514,592,660` call `forceEnteredState()`. A fresh clone is in `init` and is safe; an element that was already `left` is not.
- Fix: one `clearPhaseClasses()` that removes all ten `ANIMATION_CLASSES` except the one being added, called from `forceEnteredState`, `forceLeftState`, and every instant/skip branch before the `-done` class is added. Add specs: `forceEnteredState()` from `left` expects no `leave-done`; `leave()` then instant `enter()` expects no `leave-active`/`leave-to`.
- Breaking: no. Decision: no.
- Status: fixed (one `settleInstantly()` clears every other animation class on force/instant/skip paths; `fullscreen-animation.ts` is affected: `:476`/`:514` force the overlay container from any state on a breakpoint switch, and `:660` forces a clone that can be `leaving`/`left` - all covered by the core fix)

## HC-02 `getScrollSnapTarget` treats a hidden (zero-rect) item as already aligned and returns `null`

- Where: `libs/core/src/lib/scrolling/snap.ts:28-76`; used by `libs/components/src/lib/scrollable/headless/scrollable-snap.directive.ts:88`.
- Problem: an item with `display: none` (or one not laid out) has `getBoundingClientRect()` all zeros. With a container at `left: 0`, `relativeStart` is `0`, `itemSize` is `0`, so `computeDelta('start')` is `0 - margin`. For `margin = 0` that is `0`, `bestAbsDelta` becomes `0`, and `if (!bestElement || bestAbsDelta < MIN_SNAP_DELTA_PX) return null` fires: no snap happens for the whole list although the visible items are misaligned. In a container at `left: 200`, the hidden item's delta is `-200`, which can still beat a real item with a larger delta and snap to an element that cannot be scrolled to. Input: `items = [hiddenEl, itemA(left: 37)]`, `container.left = 0`, `direction: 'horizontal'`, `origin: 'start'` -> returns `null`, expected `itemA`.
- Fix: skip an item when `itemRect.width === 0 && itemRect.height === 0`, or when `!item.checkVisibility?.()`/`offsetParent === null`. Add a spec with a zero-rect item next to a misaligned one.
- Breaking: no. Decision: no.
- Status: fixed

## HC-03 `[etClickOutside]` keeps `pressStartedInside` after a press with no click and swallows the next keyboard click

- Where: `libs/core/src/lib/directives/click-outside.directive.ts:19-39`.
- Problem: `pressStartedInside` is set on every capture `pointerdown` and cleared only by the next `click`. A press that never produces a click leaves it `true`: a touch that starts inside the host and turns into a scroll (`pointercancel`, no click), or a drag released in a different element that suppresses click. The next click without a `pointerdown`, such as Enter/Space on a focused button outside the host (a synthesized click carries no pointer events), then reads `startedInside === true` and returns early, so the "click outside" is dropped once. Repro: touch-scroll inside a popover that uses `etClickOutside` to close, then focus an outside button and press Enter.
- Fix: also reset `pressStartedInside = false` on `pointerup`/`pointercancel` (capture) after a microtask, or compare timestamps (`event.timeStamp` of the click against the last `pointerdown`), or only honour the flag when the click's `detail > 0`. Add a spec: `pointerdown` inside, `pointercancel`, then a dispatched `click` outside, expect one emit.
- Breaking: no. Decision: no.
- Status: fixed (reset on capture `pointercancel`)

## HC-04 `signalElementIntersection` appends entries out of DOM order when `rootMargin` is non-zero

- Where: `libs/core/src/lib/signals/element-intersection.ts:97-125,166-176`; consumed by `libs/core/src/lib/scrolling/snap.ts:101-189`.
- Problem: when an element is added and `rootMargin` is not zero, `updateObservedElements` skips the synthetic first entry (`:166`) and leaves the element out of `newIntersectionValue`. The IO callback then appends it at the end (`:97-99`, the `else` branch). `getScrollContainerTarget` and `getScrollItemTarget` assume `entries` are in DOM order (`entries.indexOf`, `index - 1`, `index + 1`). Insert an item in the middle of a scrollable list with a non-zero margin and "scroll to previous/next item" picks the wrong neighbour. With zero margin the list is rebuilt in element order, so the bug shows only with a margin.
- Fix: when `updateIntersections` appends an unseen target, insert it at its index in `elements().currentElements`, or sort the result by the order of the observed elements before `set`. Add a spec: three elements, margin `10px`, insert one in the middle, fire its entry, expect entries in DOM order.
- Breaking: no. Decision: no.
- Status: fixed (entries sorted by the observed elements' order)

## HC-05 `isElementVisible().intersectionRatio` is `min(inline, block)`, not an area ratio, so it disagrees with the IntersectionObserver

- Where: `libs/core/src/lib/scrolling/scrollable.ts:154-163`; seeds entries at `libs/core/src/lib/signals/element-intersection.ts:166-189`.
- Problem: for an element half visible on both axes the IO reports `0.25` (area), `isElementVisible` reports `0.5` (`Math.min(0.5, 0.5)`). The synthetic first entry is shown to the consumer before the observer's own entry replaces it, so with `threshold: 0.5` logic a diagonally clipped element reads as "50 % visible" for one frame and then "25 %". `snap.ts` also compares `intersectionRatio >= 0.99` on these entries (`FULLY_VISIBLE_RATIO`), which is safe, but anything with a partial threshold is not.
- Fix: use `inlineIntersectionPercentage * blockIntersectionPercentage` for `intersectionRatio`. Add a spec for a corner-clipped element.
- Breaking: no (value change for corner-clipped elements). Decision: no.
- Status: fixed

## HC-06 `createUnsavedChangesTracker({ defaultValue: null })` never captures a baseline and is never dirty

- Where: `libs/core/src/lib/unsaved-changes/unsaved-changes-tracker.ts:143-165`.
- Problem: `hasExplicitDefault = config.defaultValue !== undefined`, so `null` counts as an explicit default. The auto-capture `effect` is skipped (`if (!hasExplicitDefault)`), `_defaultValue` stays `null`, and `hasChanges` returns `false` for `defaultValue === null` (`:164`). A form value typed `Draft | null` that starts `null` and is filled later never reports changes, with no warning. The doc says capture happens when the default is "omitted".
- Fix: treat `null` like `undefined` for `hasExplicitDefault`, so the first non-null value is captured. Add a spec with `defaultValue: null` and a later `.set({ name: 'a' })` then an edit.
- Breaking: no. Decision: no.
- Status: fixed

## HC-07 No spec for `getScrollSnapTarget` with a hidden item, scroll-observer directives, or intersection order with margin

- Where: `libs/core/src/lib/scrolling/snap.spec.ts` (no zero-rect case), `libs/core/src/lib/directives/scroll-observer*.directive.ts` (no spec, no scenario), `libs/core/src/lib/signals/element-intersection.ts` (only `element-observers.scenario.spec.ts`).
- Problem: HC-02 and HC-04 are exactly the cases these specs lack. `ScrollObserverDirective.registerStart/registerEnd` also have an identity check on unregister (`current === el`) that nothing tests: a second `etScrollObserverStart` replacing the first and the first one destroying later must keep the second observed.
- Fix: add the specs named in HC-02 and HC-04, plus a scenario for `etScrollObserver` with a replaced and a destroyed start marker, checking `isAtStart()` and that no `IntersectionObserver` is left connected after teardown.
- Breaking: no. Decision: no.
- Status: fixed (snap spec, intersection-order and scroll-observer scenarios in `hunt-core-fixes.scenario.spec.ts`)
