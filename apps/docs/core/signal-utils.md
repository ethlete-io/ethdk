# Signal utilities

Inject-style signal helpers for media queries, router state, form controls and animation, plus general signal plumbing. Everything here requires an injection context; unless noted otherwise, the return value is a `Signal`.

## Media queries & breakpoints

Sugar on top of the [breakpoint observer](/core/providers#breakpoint-observer). The `inject*` helpers are **memoized per environment injector** — calling them repeatedly returns the same signal instance, so they're cheap to use everywhere:

| Helper                                                                      | Returns                                             |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| `injectIsXs()` … `injectIs2Xl()`                                            | `Signal<boolean>` per breakpoint band.              |
| `injectCurrentBreakpoint()`                                                 | `Signal<Breakpoint>`                                |
| `injectObserveBreakpoint({ min?, max? })`                                   | `Signal<boolean>` for a custom range.               |
| `injectObserveMediaQuery(query)`                                            | `Signal<boolean>` for a raw query.                  |
| `injectPrefersReducedMotion()`                                              | `Signal<boolean>`                                   |
| `injectCanHover()`                                                          | `Signal<boolean>` (`hover: hover`)                  |
| `injectHasTouchInput()` / `injectHasPrecisionInput()`                       | `Signal<boolean>` (`pointer: coarse` / `fine`)      |
| `injectDeviceInputType()`                                                   | `Signal<'touch' \| 'mouse'>`                        |
| `injectIsPortrait()` / `injectIsLandscape()` / `injectDisplayOrientation()` | orientation signals                                 |
| `injectViewportDimensions()`                                                | `Signal<NullableElementDimensions>` of `<html>`     |
| `injectScrollbarDimensions()`                                               | `Signal<{ width, height } \| null>` — measured once |

`injectBreakpointIsMatched(options)` and `injectMediaQueryIsMatched(query)` are the non-reactive variants — they return a plain `boolean`, not a signal.

### Breakpoint inputs

Let a component input accept either a plain value or a per-breakpoint map (`{ xs: 1, md: 3 }`), resolved mobile-first against the current breakpoint:

```ts
import {
  provideBreakpointInstance,
  numberBreakpointTransform,
  boolBreakpointTransform,
  typedBreakpointTransform,
} from '@ethlete/core';

@Component({
  providers: [provideBreakpointInstance(MyGridComponent)],
})
export class MyGridComponent {
  columns = input(1, { transform: numberBreakpointTransform() });
  snap = input(false, { transform: boolBreakpointTransform() });
  itemSize = input('auto', { transform: typedBreakpointTransform<ItemSize>() });
}
```

`provideBreakpointInstance(ComponentClass)` in the component's `providers` is required for the transforms to re-resolve when the breakpoint changes. For a signal you already hold, `injectBreakpointInput(signal, defaultValue)` resolves it into a plain `Signal<T>`.

::: warning The keys are `xs sm md lg xl 2xl` — and only those
A map with **one** unrecognized key stops being a breakpoint map entirely: it is passed through as a plain value, which for an attribute binding means `[object Object]` and no effect at all. There is no `default` key — the smallest breakpoint you specify is the fallback, so write `{ xs: 'full', lg: 'third' }`. Dev mode warns when a map has some valid keys and some not.
:::

## Router signals

Committed router state as signals — safe to read in child-component constructors, with SSR-aware initial values:

| Helper                                           | Returns                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `injectUrl()`                                    | `Signal<string>` — full URL incl. query & fragment.                                |
| `injectRoute()`                                  | `Signal<string>` — URL without query/fragment.                                     |
| `injectQueryParams()` / `injectQueryParam(key)`  | All query params / a single one.                                                   |
| `injectPathParams()` / `injectPathParam(key)`    | Path params (deepest route).                                                       |
| `injectRouteData()` / `injectRouteDataItem(key)` | Route `data`.                                                                      |
| `injectRouteTitle()`                             | `Signal<string \| null>`                                                           |
| `injectFragment()`                               | `Signal<string \| null>`                                                           |
| `injectRouterState()`                            | `Signal<RouterState>` — data, params, query params, title, fragment in one object. |
| `injectIsRouterInitialized()`                    | `Signal<boolean>` — true after the first real navigation.                          |

The single-value helpers accept `{ transform }` (Angular-input-style) — e.g. `injectQueryParam('page', { transform: numberAttribute })`. `injectQueryParam` additionally accepts `requireSync: true` to read the initial value synchronously from the browser URL.

`injectQueryParamChanges()` / `injectPathParamChanges()` emit only the keys that changed in the latest navigation; removed keys carry the `ET_PROPERTY_REMOVED` sentinel.

For synchronous, non-injected use inside `router.events` handlers there are `createRouterState(router)` and `createRoute(router)`.

`injectRouterNavigationState<T>()` reads the state a navigation was given — what `router.navigate(…, { state })` passed. It returns `T | null` **synchronously** and is deliberately not a signal: navigation state exists only for the duration of the navigation carrying it, so by the time an effect flushed the answer would always be `null`. Call it in a constructor or a resolver, and always handle `null` — a page arrived at by typing its URL has no navigation state.

Use it for what a URL should not carry (a "you were redirected because…" reason, an object the previous page already had, a scroll intent). Anything that must survive a reload belongs in the URL.

## Form control values

`controlValueSignal(control, options?)` turns an `AbstractControl` (or a signal of one) into a `Signal` of its **raw** value — including disabled controls — deduplicated by deep equality. Options: `debounceTime` and `debounceFirst` (default `false`: the initial value is emitted immediately). `controlValueSignalWithPrevious` yields `[previous, current]` tuples.

## Animated numbers

`signalAnimatedNumber(source, options?)` returns a read-only signal that tweens toward the source value — for count-up stats and animated meters:

```ts
import { signalAnimatedNumber } from '@ethlete/core';

score = signal(50);
animatedScore = signalAnimatedNumber(this.score).play();
```

| Option                                | Default      | Description                    |
| ------------------------------------- | ------------ | ------------------------------ |
| `initialValue`                        | `0`          | Start value.                   |
| `duration`                            | `1000`       | Tween duration in ms.          |
| `easing`                              | `easeOut`    | Any `(t: number) => number`.   |
| `round`                               | `Math.round` | Applied to each emitted value. |
| `onAnimationStart` / `onAnimationEnd` | —            | Callbacks.                     |

Nothing animates until you call `.play()`; `.stop()` and `.reset()` are also chainable. The RAF loop runs outside the Angular zone. Easing presets ship alongside: `easeLinear`, `easeIn`, `easeOut`, `easeInOut`, `easeElastic`, `easeOutBack`, `easeOutBackStrong`.

## Signal plumbing

| Helper                                                     | Purpose                                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `syncSignal(from, to, options?)`                           | Keep a writable signal in sync with a source signal; returns the `EffectRef`. Options: `skipSyncRead`, `skipFirstRun` (both default `false`). |
| `previousSignalValue(signal)`                              | Signal of the source's previous value (initially `undefined`).                                                                                |
| `computedTillTruthy(source)` / `computedTillFalsy(source)` | Track the source only until it first becomes truthy/falsy, then freeze.                                                                       |
| `deferredSignal(valueFn)`                                  | `null` until after the next render, then `valueFn()` — for values that need inputs to be set.                                                 |
| `memoizeSignal(factory)`                                   | Cache a signal factory per environment injector (how the `inject*` helpers above are built).                                                  |
| `MaybeSignal<T>` / `maybeSignalValue(v)`                   | The "value or signal" input type used across the SDK, and its unwrapper.                                                                      |

## Recipes

Higher-level behaviors composed from the primitives:

- **`useCursorDragScroll(el, options?)`** — click-and-drag ("grab") scrolling on any scrollable element. Options: `enabled` (signal, default `true`), `allowedDirection` (`'horizontal' | 'vertical' | 'both'`, default `'both'`). Returns `{ isDragging, currentDragAmount }` signals; the [scrollable component](/components/scrollable) uses it under the hood.
- **`setupScrollRestoration(config?)`** — app-wide navigation scroll management: scroll-to-top, fragment scrolling and — opt-in — real scroll restoration on back/forward. See [below](#navigation-scrolling-scroll-restoration).
- **`writeScrollbarSizeToCssVariables()`** / **`writeViewportSizeToCssVariables()`** — write `--et-sw`/`--et-sh` (scrollbar size) and `--et-vw`/`--et-vh` (viewport size excl. scrollbar) onto `<html>`. Call once at app start (idempotent, browser-only).

### Navigation scrolling & scroll restoration

Call `setupScrollRestoration()` once at app start, in an injection context (e.g. an
`APP_INITIALIZER`-style provider or the root component's constructor). It is a no-op on the server.

```ts
setupScrollRestoration({
  // Pass a getter when the scroll container is the app shell or is created per route.
  scrollElement: () => document.querySelector<HTMLElement>('.app-shell'),
  queryParamTriggerList: ['page'],
  fragment: { enabled: true },
  restore: { enabled: true },
});
```

| Option                  | Default                             | Description                                                                           |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------------- |
| `scrollElement`         | `document.documentElement`          | The scrolled element, or a getter resolved on every navigation.                       |
| `queryParamTriggerList` | `[]`                                | Query params that scroll to top when they change on the same route (e.g. `['page']`). |
| `fragment`              | `{ enabled: false, smooth: false }` | Scroll to the element matching the URL fragment.                                      |
| `restore`               | `{ enabled: false }`                | Restore the previous offset on back/forward instead of scrolling to top — see below.  |

Opt individual routes out of scroll-to-top with
`data: routerDisableScrollTop({ asReturnRoute?, onPathParamChange? })`.

#### Restoring the offset on back/forward

Native browser restoration is wrong for data-driven pages: on back-navigation the queries re-execute
and the page renders skeletons or empty states first, so the document is far shorter than it was when
the user left — and the browser applies the saved offset against that short document.

With `restore.enabled`, the offset is captured per history entry and re-applied **only once the
content is tall enough to actually reach it**. Nothing has to opt in: the scroll container's own
height is the signal, so it works for lists, images, fonts and virtualized tables alike. The
restoration is abandoned if the user scrolls in the meantime.

| `restore` option | Default | Description                                                                                   |
| ---------------- | ------- | --------------------------------------------------------------------------------------------- |
| `enabled`        | `false` | Turn restoration on. Also sets `history.scrollRestoration = 'manual'`.                        |
| `timeout`        | `1000`  | How long (ms) to wait for the content to grow tall enough. Suspended while a hold is pending. |
| `maxTimeout`     | `10000` | Absolute cap (ms) per attempt, regardless of holds.                                           |
| `clampOnTimeout` | `true`  | On timeout, apply the offset clamped to the reachable maximum instead of staying put.         |

If a page's data can take longer than `timeout` to arrive, suspend the wait from the route component:

```ts
holdScrollRestoration(() => query.isLoading());
```

The registration lives for the lifetime of the injection context. Multiple holds are allowed —
restoration waits while any of them reads `true`.

Notes:

- Restoration only applies to `popstate` navigations that have a stored offset. Clicking a link is a
  new history entry, so it still scrolls to top.
- A stored offset wins over both `queryParamTriggerList` and fragment scrolling — the user may have
  scrolled away from the anchor before leaving.
- `routerDisableScrollTop({ asReturnRoute: true })` was a workaround for the absence of restoration.
  It still works, but with `restore.enabled` you generally don't need it.
