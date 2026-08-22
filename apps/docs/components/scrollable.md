# Scrollable

`et-scrollable` upgrades a native scroll container with edge masks, scroll-snap, cursor drag-scrolling, prev/next buttons, navigation dots and programmatic scrolling. Import `SCROLLABLE_IMPORTS` for the track, and an extra imports array per feature you actually use.

```html
<et-scrollable etScrollableSnap scrollMode="element" itemSize="third">
  @for (item of items(); track item.id) {
  <article [etScrollableActiveChild]="item.active">{{ item.label }}</article>
  }
</et-scrollable>
```

```ts
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '@ethlete/components';
```

## Opt-in features

Everything optional is a directive you put on the `<et-scrollable>` itself, and each ships in its own imports array. A track you only scroll therefore carries no buttons, no icon button, no spinner and no drag code - you pay for what you write.

| Imports array                   | Directive                  | What it adds                                                            |
| ------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `SCROLLABLE_NAVIGATION_IMPORTS` | `[etScrollableButtons]`    | Prev/next buttons. Config: `{ position, sticky, enabled }`              |
| `SCROLLABLE_NAVIGATION_IMPORTS` | `[etScrollableNavigation]` | Dot navigation below the track. Config: `{ enabled }`                   |
| `SCROLLABLE_DRAG_IMPORTS`       | `[etScrollableDrag]`       | Drag the track with a mouse. Takes a boolean to toggle                  |
| `SCROLLABLE_DRAG_IMPORTS`       | `[etScrollableSnap]`       | Native scroll snap; also takes `snapOrigin` - see [Snapping](#snapping) |
| `SCROLLABLE_DARKEN_IMPORTS`     | `[etScrollableDarken]`     | Dims children that are only partly in view. Takes a boolean to toggle   |

```html
<et-scrollable
  [etScrollableButtons]="{ position: 'footer', sticky: true }"
  etScrollableDrag
  etScrollableNavigation
  etScrollableSnap
  snapOrigin="center"
>
  …
</et-scrollable>
```

```ts
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '@ethlete/components';
```

A directive cannot be applied conditionally, so each takes a value to switch it off at runtime - `[etScrollableDrag]="false"`, `[etScrollableButtons]="{ enabled: canScroll() }"` - rather than being added and removed.

## Live demo

<StoryEmbed id="components-layout-scrollable--default" height="360px" />

## Options

| Input                     | Default        | Notes                                                                                                 |
| ------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `direction`               | `'horizontal'` | or `'vertical'`                                                                                       |
| `itemSize`                | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` - sizes children as viewport fractions |
| `scrollMode`              | `'container'`  | `'element'` scrolls child-by-child (pair with snap)                                                   |
| `scrollOrigin`            | `'auto'`       | Where scrolled-to elements align: `'auto' \| 'start' \| 'center' \| 'end'`                            |
| `scrollMargin`            | `0`            | Extra margin (px) when scrolling elements into view (incl. snap)                                      |
| `renderMasks`             | `true`         | Edge fades; `maskVariant: 'gradient' \| 'border'`                                                     |
| `renderScrollbars`        | `false`        | Show the native scrollbar instead of hiding it                                                        |
| `loadingTemplatePosition` | `'end'`        | Where `etScrollableLoadingTemplate` content renders                                                   |
| `scrollableRole`          | -              | `role` attribute for the scroll container (e.g. `list`)                                               |
| `scrollableClass`         | -              | Extra class(es) on the scroll container                                                               |
| `color`                   | -              | App-registered color theme for buttons/dots                                                           |

### Snapping

Snapping is `[etScrollableSnap]` from `SCROLLABLE_DRAG_IMPORTS`, applied on the `<et-scrollable>` itself.

It is **native CSS scroll snap**, so the browser folds it into the fling itself, on the compositor: a
swipe decelerates straight onto a child and stops. `snapOrigin` decides where that child comes to rest, and
maps onto CSS like this:

| `snapOrigin`       | `scroll-snap-type` | `scroll-snap-align` |
| ------------------ | ------------------ | ------------------- |
| `'auto'` (default) | `proximity`        | `start`             |
| `'start'`          | `mandatory`        | `start`             |
| `'center'`         | `mandatory`        | `center`            |
| `'end'`            | `mandatory`        | `end`               |

`'auto'` is `proximity` because that is what "take whichever edge it is already nearest" becomes in CSS:
snap when the gesture ended close to a child, otherwise leave a plain list alone. `'center'` suits a peeking
layout where the point is one current item with its neighbours showing either side (that is what
[carousel](/components/carousel)'s `slideAlign` sets). Children marked `[etScrollableIgnoreChild]` get no
snap position.

This used to be JavaScript throughout - wait 150ms for the scrolling to go quiet, find the nearest child,
animate there - and on a touch screen that made every swipe stop twice: the gesture ended, the track sat
still, and then a second ~200ms animation ran to correct it, sometimes by three pixels.

#### Snapping and programmatic scrolling

`scroll-snap-type: mandatory` does not merely bias where a scroll settles - it **overrules a programmatic
offset outright, and silently.** On a track whose snap positions are 306px apart,
`container.scroll({ left: 950, behavior: 'instant' })` lands at 918 and reports 918; `container.scrollLeft = 1260`
lands at 1224. Anything that means a specific offset therefore has to take snapping off the table while it
writes one, which is what `ScrollableDirective.suspendSnap()` is for: it puts `snap-suspended` on the host,
which the CSS gates `scroll-snap-type` on, and returns the function that hands snapping back. It is
ref-counted, so two overlapping suspensions can't release each other's.

Two things use it already. A **cursor drag** holds it for the whole drag, because it writes the offset on
every mouse move; on release it glides to the nearest child in JavaScript and hands snapping back on arrival

- a mouse button produces no fling, so native snap has nothing to decelerate into and letting go would
  otherwise hard-cut the track by up to a slide in a single frame. A looping [carousel](/components/carousel)
  holds it while it shifts the track across the loop seam.

`itemSize`, `direction` and `scrollMode` also accept per-breakpoint maps (e.g. `[itemSize]="{ xs: 'full', md: 'third' }"`) - see [breakpoint inputs](/core/signal-utils#breakpoint-inputs) for how these resolve. The underlying scroll math (snap targets, `scrollToElement`) comes from the [core scrolling primitives](/core/scrolling).

Helper directives: `[etScrollableActiveChild]` marks the child the track should open on - see [Active child](#active-child); `[etScrollableIgnoreChild]` excludes an element from child tracking; `ng-template[etScrollableLoadingTemplate]` renders skeleton content while `showLoadingTemplate` is on.

### Active child

Mark a child with `[etScrollableActiveChild]` and the track opens scrolled to it - for when the selected tab, day or match sits somewhere in the middle of a long list:

```html
<et-scrollable>
  @for (day of days(); track day.id) {
  <button [etScrollableActiveChild]="day.id === selectedDayId()">{{ day.label }}</button>
  }
</et-scrollable>
```

The first enabled marker in DOM order wins, and `scrollOrigin` decides where it comes to rest. This is a one-time **initial** scroll position, not a live binding: it is applied the first time the track is actually able to scroll to that child, and later changes to the bindings don't re-scroll it - drive those with `scrollToElement(...)` instead. A marker bound to `false` registers the child but never claims the initial position, so `[etScrollableActiveChild]="false"` on every child means the track opens at the start.

## State & programmatic scrolling

- `(scrollStateChange)` emits `{ canScroll, isAtStart, isAtEnd }`.
- `(intersectionChange)` emits per-child visibility ratios (debounced), which is what powers the dots and darkening.
- On the headless `ScrollableDirective` (exported as `etScrollable`): `scrollToElement(...)`, `scrollToElementByIndex({ index })`, and `scrollToStartDirection()` / `scrollToEndDirection()` - one container or item step back/forward, which is what the prev/next buttons call. `getActiveChildren()` and `getScrollContainerRef()` expose the tracked children and the container element as readonly signals.

<StoryEmbed id="components-layout-scrollable--with-snap" height="360px" />

## Accessibility

The prev/next buttons and dot navigation are pointer conveniences: both are `aria-hidden` and removed from the tab order, since the same content is reachable by scrolling natively. The scroll container itself carries no implicit semantics - describe your content via `scrollableRole` (e.g. `role="list"`) and the children's own markup.

## Error codes

A scrollable without a registered scroll container throws [`ET2100`](/components/error-codes#scrollable-et21xx) in dev mode.
