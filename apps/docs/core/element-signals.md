# Element signals

Reactive DOM observation as Angular signals - element size, intersection, mutations, scrollability and children, each backed by the right browser observer and cleaned up automatically on destroy.

```ts
import { signalElementDimensions, signalHostClasses, signalHostElementScrollState } from '@ethlete/core';

@Component({/* … */})
export class ScrollShadowComponent {
  container = viewChild<ElementRef<HTMLElement>>('container');

  scrollState = signalHostElementScrollState();
  containerDimensions = signalElementDimensions(this.container);

  hostClassBindings = signalHostClasses({
    'my-comp--can-scroll': computed(() => this.scrollState().canScroll),
  });
}
```

Shared rules for everything on this page:

- **Injection context required** - call the helpers in a constructor or field initializer.
- **Flexible element binding** - the `el` argument (`SignalElementBindingType`) accepts an `HTMLElement`, `ElementRef`, `QueryList`, an array of those, or a signal/observable of any of them. When the bound element changes, observers move with it. Every helper also has a `signalHost*` variant that binds to the component's own host element.
- **SSR-safe** - the observers only attach after first render (`signalIsRendered()`); until then you get the empty/initial value.

## Dimensions

`signalElementDimensions(el)` / `signalHostElementDimensions()` → `Signal<NullableElementDimensions>` via `ResizeObserver`:

| Field    | Type                | Description                              |
| -------- | ------------------- | ---------------------------------------- |
| `rect()` | `() => ElementRect` | Lazy `getBoundingClientRect()` snapshot. |
| `client` | `ElementSize`       | `clientWidth` / `clientHeight`.          |
| `scroll` | `ElementSize`       | `scrollWidth` / `scrollHeight`.          |
| `offset` | `ElementSize`       | `offsetWidth` / `offsetHeight`.          |

All fields are `null` while no element is bound.

`injectViewportSize()` → `Signal<ElementSize>` for the viewport, preferring `visualViewport` over `window` resize events.

## Animated block size

`injectAnimatedBlockSize(config)` smoothly animates an element's `block-size` as its content changes size - a list filtering, a loading state resolving, an error line appearing. Set it up once in an injection context; it observes the content element(s) and animates the host from its previous height to its new natural height (used by `et-menu` and the rich text editor's trigger popup).

```ts
injectAnimatedBlockSize({
  observe: this.bodyElement, // content whose size drives the animation
  resizingClass: 'my-panel--resizing', // toggled on the host while animating (e.g. to `overflow: clip`)
});
```

| Option          | Default           | Description                                                                                              |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `observe`       | - (required)      | Content element binding(s) whose size changes drive the animation. **Not** the animated host.            |
| `host`          | host `ElementRef` | The element whose size is animated.                                                                      |
| `axes`          | `['block']`       | Axes to animate (`'block'` / `'inline'`), as an array or a signal - e.g. drop `inline` per presentation. |
| `duration`      | `160`             | Animation duration in ms.                                                                                |
| `easing`        | `'ease'`          | Animation easing.                                                                                        |
| `resizingClass` | -                 | Class toggled on the host while animating.                                                               |

Observe the content (children), not the host - observing the animated host would feed the animation back into itself. For the `inline` axis this also means the observed content must be content-sized (e.g. `inline-size: max-content`); a plain block-level child just mirrors the host's animated width back. The baseline size is captured on the first render, so the initial layout never plays as a grow-from-0; an interrupting change continues from the current animated size; and it respects `prefers-reduced-motion` (used with both axes by `et-cascader`'s panel, which grows/shrinks as columns drill in and out).

## Intersection

`signalElementIntersection(el, options?)` / `signalHostElementIntersection(options?)` → `Signal<IntersectionObserverEntryWithDetails[]>`. Options are `IntersectionObserverInit` plus `root` (any element binding) and `enabled` (a `Signal<boolean>`, default enabled). Each entry is the native `IntersectionObserverEntry` enriched with `isAbove` / `isBelow` / `isLeft` / `isRight` / `isVisible`, and an initial entry is seeded synchronously so you don't wait for the first observer callback.

## Mutations

`signalElementMutations(el, options?)` / `signalHostElementMutations(options?)` → `Signal<MutationRecord | null>` with standard `MutationObserverInit` options.

## Scroll state

`signalElementScrollState(el)` / `signalHostElementScrollState()` → `Signal<ElementScrollState>`:

```ts
{
  (canScroll, canScrollHorizontally, canScrollVertically, elementDimensions);
}
```

Recomputes on both resizes and DOM mutations. Pass `{ initialScrollPosition }` (a `Signal<ScrollToOptions | null>`) to apply a one-time scroll position once the element renders.

`signalElementLastScrollDirection(el)` / the host variant track the last scroll direction as `{ type: 'up' | 'down' | 'left' | 'right', time }`.

## Children

`signalElementChildren(el)` → `Signal<HTMLElement[]>` - the element's direct children, kept in sync via a MutationObserver. Handy for headless components that observe projected content.

## Class, attribute & style bindings

Declarative host/element bindings driven by signals - the signal flips, the DOM updates, and bindings are cleaned off elements that leave the binding:

| Function                                                  | Effect                                                                                                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signalClasses(el, map)` / `signalHostClasses(map)`       | Toggles CSS classes; keys may contain multiple space-separated classes.                                                                            |
| `signalAttributes(el, map)` / `signalHostAttributes(map)` | Sets attributes; `null`/`undefined` removes. Boolean-presence attributes (`disabled`, `hidden`, `inert`, …) are set to `""`/removed by truthiness. |
| `signalStyles(el, map)` / `signalHostStyles(map)`         | Sets inline styles (dash-case, so custom properties work); `null` removes.                                                                         |

```ts
hostClassBindings = signalHostClasses({
  'et-scrollable--can-scroll': this.canScroll,
  'et-scrollable--is-at-start': this.isAtStart,
});
```

Each call returns a handle with `push` / `remove` / `has` to add or drop bindings at runtime. The lower-level `buildSignalEffects` powers all six, if you need a custom token-applying binding.

## Render guards

- `signalIsRendered()` - `false` until `afterNextRender`, then `true`. The SSR/first-paint guard used by everything above.
- `createCanAnimateSignal()` - a state signal that flips `true` one frame after render; use it to suppress enter animations on initial paint.
- `createIsRenderedSignal()` - manual variant for components that need to control when the "rendered" state binds (call `bind()` at the end of the constructor).
