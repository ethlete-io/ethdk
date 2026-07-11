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

## Form control values

`controlValueSignal(control, options?)` turns an `AbstractControl` (or a signal of one) into a `Signal` of its **raw** value — including disabled controls — deduplicated by deep equality. Options: `debounceTime` and `debounceFirst` (default `false`: the initial value is emitted immediately). `controlValueSignalWithPrevious` yields `[previous, current]` tuples.

## Animated numbers

`signalAnimatedNumber(source, options?)` returns a read-only signal that tweens toward the source value — for count-up stats and animated meters:

```ts
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
- **`setupScrollRestoration(config?)`** — app-wide scroll-to-top on navigation, with fragment scrolling (`fragment: { enabled, smooth }`, both default `false`) and query-param triggers. Opt routes out via `data: routerDisableScrollTop({ asReturnRoute?, onPathParamChange? })`. No-op on the server.
- **`writeScrollbarSizeToCssVariables()`** / **`writeViewportSizeToCssVariables()`** — write `--et-sw`/`--et-sh` (scrollbar size) and `--et-vw`/`--et-vh` (viewport size excl. scrollbar) onto `<html>`. Call once at app start (idempotent, browser-only).
