# Animations

A CSS-class-driven enter/leave animation system - directives manage a lifecycle state machine and apply well-known `et-animation-*` classes; your CSS defines what actually animates. Gate CSS transitions with `prefers-reduced-motion` (or [`injectPrefersReducedMotion()`](/core/signal-utils#media-queries-breakpoints) in TS). The FLIP helper handles reduced motion automatically unless `ignoreReducedMotion` is set.

## Animated lifecycle

`AnimatedLifecycleDirective` (`[etAnimatedLifecycle]`, exportAs `etAnimatedLifecycle`) drives enter/leave transitions on its host. Call `enter()` / `leave()` and style the class hooks:

```css
.my-panel.et-animation-enter-from {
  opacity: 0;
  translate: 0 8px;
}
.my-panel.et-animation-enter-active {
  transition:
    opacity 150ms,
    translate 150ms;
}
```

```ts
import { AnimatedLifecycleDirective } from '@ethlete/core';
```

The class cycle mirrors Vue's transition contract:

| Phase | Classes (in order)                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------- |
| Enter | `et-animation-enter-from` → `et-animation-enter-active` → `et-animation-enter-to` → `et-animation-enter-done` |
| Leave | `et-animation-leave-from` → `et-animation-leave-active` → `et-animation-leave-to` → `et-animation-leave-done` |

The host additionally carries `et-force-invisible` until the first transition starts. Interrupting a running transition (entering while leaving, or vice versa) is handled - classes swap and an `-interrupt` class is added for that cycle.

API surface:

| Member                                     | Description                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `enter()` / `leave()`                      | Start (or redirect) a transition.                                                                                                              |
| `state$` / `stateChange`                   | `'init' \| 'entering' \| 'entered' \| 'leaving' \| 'left'`.                                                                                    |
| `forceEnteredState()` / `forceLeftState()` | Jump to the end state synchronously, cancelling any animation.                                                                                 |
| `skipNextEnter` input                      | When `true`, the next `enter()` completes instantly, then the flag resets. Useful for content that mounts inside an already-visible container. |

The directive settles even when the browser never fires the expected `transitionend` (cancelled or replaced transitions), so state can't get stuck.

## Animated if

`*etAnimatedIf` is `*ngIf` with exit animations: it creates the view and calls `enter()` when the value turns truthy, and on falsy calls `leave()` - removing the view only once the lifecycle reaches `'left'`. It requires an `etAnimatedLifecycle` on an ancestor element:

```html
<div class="hint" etAnimatedLifecycle>
  <ng-container *etAnimatedIf="showHint()">
    <p>Some animated hint</p>
  </ng-container>
</div>
```

```ts
import { AnimatedIfDirective } from '@ethlete/core';
```

## Animatable

`AnimatableDirective` (`[etAnimatable]`, exportAs `etAnimatable`) observes CSS animation/transition activity on its host - without driving it. Nested animatables aggregate their counts upward.

| Member                                        | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| `animationStart$`                             | Emits once per animation batch start.                        |
| `animationEnd$`                               | Emits `{ cancelled, transitionId? }` when the batch settles. |
| `isAnimating$` / `totalActiveAnimationCount$` | Live activity state including children.                      |
| `getRunningAnimations()`                      | The animations running on the host element right now.        |

Typical use: defer cleanup until a leave animation actually finished (the form field does this for error messages).

The observables above are event-driven, so they turn true only once the browser has dispatched
`transitionrun` - a frame after it commits the style change. To decide whether a class change you
just made started an animation, use `getRunningAnimations()`: reading it flushes the pending style,
so the answer holds even when the browser has not committed yet. `AnimatedLifecycleDirective` ends
its transitions on that reading.

## FLIP animations

`createFlipAnimation({ element, originElement?, duration?, easing?, ignoreReducedMotion? })` animates an element from a measured previous position/size to its current one using the Web Animations API - the tab bar underline is built on it. Defaults: `duration: 250`, `easing: 'cubic-bezier(0.4, 0, 0.2, 1)'`, `originElement` = the element itself, and reduced motion respected. Returns `{ updateInit, play, cancel, onStart$, onFinish$, onCancel$ }`. `createFlipAnimationGroup` runs several in lockstep and exposes the same three outputs for the group as a whole: `onStart$` once every element has started, then exactly one of `onFinish$` (all finished) or `onCancel$` (at least one was cancelled) per `play()`. `matchesReducedMotion(element)` is available when a custom animation needs the same check.

## Frame utilities

- `nextFrame(cb)` / `fromNextFrame()` - run a callback (or emit once) on the next _painted_ frame (double `requestAnimationFrame`).
- `forceReflow(element?)` - force a synchronous layout (reads `offsetHeight`; defaults to `document.body`). Needed between applying a `-from` class and starting a transition.

## Debugging

Set `localStorage.setItem('et-overlay-debug', 'true')` and reload to get timestamped console traces from the lifecycle directive and the [overlay runtime](/core/overlay-runtime).

::: warning Legacy: `AnimatedOverlayDirective`
`[etAnimatedOverlay]` (CDK-overlay + Floating UI mounting) is superseded and now lives in the maintenance-mode `@ethlete/cdk` package - import it from `@ethlete/cdk` instead of `@ethlete/core`. New code should use the [components overlay system](/components/overlays), which is built on the [overlay runtime](/core/overlay-runtime).
:::
