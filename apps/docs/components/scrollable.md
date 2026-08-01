# Scrollable

`et-scrollable` upgrades a native scroll container with prev/next buttons, edge masks, scroll-snap, cursor drag-scrolling, navigation dots and programmatic scrolling. Import `SCROLLABLE_IMPORTS`.

```html
<et-scrollable [snap]="true" scrollMode="element" itemSize="third">
  @for (item of items(); track item.id) {
  <article [etScrollableActiveChild]="item.active">{{ item.label }}</article>
  }
</et-scrollable>
```

```ts
import { SCROLLABLE_IMPORTS } from '@ethlete/components';
```

## Live demo

<StoryEmbed id="components-scrollable--default" height="360px" />

## Options

| Input                        | Default        | Notes                                                                                                 |
| ---------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `direction`                  | `'horizontal'` | or `'vertical'`                                                                                       |
| `itemSize`                   | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` - sizes children as viewport fractions |
| `scrollMode`                 | `'container'`  | `'element'` scrolls child-by-child (pair with snap)                                                   |
| `scrollOrigin`               | `'auto'`       | Where scrolled-to elements align: `'auto' \| 'start' \| 'center' \| 'end'`                            |
| `scrollMargin`               | `0`            | Extra margin (px) when scrolling elements into view (incl. snap)                                      |
| `snap`                       | `false`        | Snap the track onto a child, with native CSS scroll snap - see [Snapping](#snapping)                  |
| `snapOrigin`                 | `'auto'`       | Where a snapped child rests: `'auto' \| 'start' \| 'center' \| 'end'`. Only used with `snap`          |
| `renderButtons`              | `true`         | Prev/next buttons; `buttonPosition: 'inside' \| 'footer'`, `stickyButtons`                            |
| `renderMasks`                | `true`         | Edge fades; `maskVariant: 'gradient' \| 'border'`                                                     |
| `renderNavigation`           | `false`        | Dot navigation                                                                                        |
| `renderScrollbars`           | `false`        | Show the native scrollbar instead of hiding it                                                        |
| `cursorDragScroll`           | `true`         | Drag with the mouse to scroll                                                                         |
| `darkenNonIntersectingItems` | `false`        | Dims children outside the viewport                                                                    |
| `loadingTemplatePosition`    | `'end'`        | Where `etScrollableLoadingTemplate` content renders                                                   |
| `scrollableRole`             | -              | `role` attribute for the scroll container (e.g. `list`)                                               |
| `scrollableClass`            | -              | Extra class(es) on the scroll container                                                               |
| `color`                      | -              | App-registered color theme for buttons/dots                                                           |

### Snapping

Snapping is **native CSS scroll snap**, so the browser folds it into the fling itself, on the compositor: a
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

Helper directives: `[etScrollableActiveChild]` marks a child as active so it's auto-scrolled into view (great for tab-bar-like lists); `[etScrollableIgnoreChild]` excludes an element from child tracking; `ng-template[etScrollableLoadingTemplate]` renders skeleton content while `showLoadingTemplate` is on.

## State & programmatic scrolling

- `(scrollStateChange)` emits `{ canScroll, isAtStart, isAtEnd }`.
- `(intersectionChange)` emits per-child visibility ratios (debounced), which is what powers the dots and darkening.
- On the headless `ScrollableDirective` (exported as `etScrollable`): `scrollToElement(...)`, `scrollToElementByIndex({ index })`, and `scrollToStartDirection()` / `scrollToEndDirection()` - one container or item step back/forward, which is what the prev/next buttons call. `getActiveChildren()` and `getScrollContainerRef()` expose the tracked children and the container element as readonly signals.

<StoryEmbed id="components-scrollable--with-snap" height="360px" />

## Accessibility

The prev/next buttons and dot navigation are pointer conveniences: both are `aria-hidden` and removed from the tab order, since the same content is reachable by scrolling natively. The scroll container itself carries no implicit semantics - describe your content via `scrollableRole` (e.g. `role="list"`) and the children's own markup.

## Error codes

A scrollable without a registered scroll container throws [`ET2100`](/components/error-codes#scrollable-et21xx) in dev mode.
