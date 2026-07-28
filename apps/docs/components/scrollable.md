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
| `itemSize`                   | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` — sizes children as viewport fractions |
| `scrollMode`                 | `'container'`  | `'element'` scrolls child-by-child (pair with snap)                                                   |
| `scrollOrigin`               | `'auto'`       | Where scrolled-to elements align: `'auto' \| 'start' \| 'center' \| 'end'`                            |
| `scrollMargin`               | `0`            | Extra margin (px) when scrolling elements into view (incl. snap)                                      |
| `snap`                       | `false`        | Snap the track onto a child once the scrolling settles                                                |
| `snapOrigin`                 | `'auto'`       | Where a snapped child rests: `'auto' \| 'start' \| 'center' \| 'end'`. Only used with `snap`          |
| `renderButtons`              | `true`         | Prev/next buttons; `buttonPosition: 'inside' \| 'footer'`, `stickyButtons`                            |
| `renderMasks`                | `true`         | Edge fades; `maskVariant: 'gradient' \| 'border'`                                                     |
| `renderNavigation`           | `false`        | Dot navigation                                                                                        |
| `renderScrollbars`           | `false`        | Show the native scrollbar instead of hiding it                                                        |
| `cursorDragScroll`           | `true`         | Drag with the mouse to scroll                                                                         |
| `darkenNonIntersectingItems` | `false`        | Dims children outside the viewport                                                                    |
| `loadingTemplatePosition`    | `'end'`        | Where `etScrollableLoadingTemplate` content renders                                                   |
| `scrollableRole`             | —              | `role` attribute for the scroll container (e.g. `list`)                                               |
| `scrollableClass`            | —              | Extra class(es) on the scroll container                                                               |
| `color`                      | —              | App-registered color theme for buttons/dots                                                           |

Snapping is ours rather than CSS `scroll-snap`: the track settles onto a child a moment after the
scrolling stops. `snapOrigin` decides where that child comes to rest — `'auto'` takes whichever of
start/centre/end it is already nearest, which keeps a plain list from being dragged around, while
`'center'` suits a peeking layout where the point is one current item with its neighbours showing either
side (that is what [carousel](/components/carousel)'s `slideAlign` sets).

A snap never happens while a pointer is held on the track. It waits for the quiet moment after a scroll,
and a gesture is full of those — without the gate, pausing mid-drag for longer than the settle delay
would scroll the content out from under the finger still holding it. Touch counts as well as the mouse.

`itemSize`, `direction` and `scrollMode` also accept per-breakpoint maps (e.g. `[itemSize]="{ xs: 'full', md: 'third' }"`) — see [breakpoint inputs](/core/signal-utils#breakpoint-inputs) for how these resolve. The underlying scroll math (snap targets, `scrollToElement`) comes from the [core scrolling primitives](/core/scrolling).

Helper directives: `[etScrollableActiveChild]` marks a child as active so it's auto-scrolled into view (great for tab-bar-like lists); `[etScrollableIgnoreChild]` excludes an element from child tracking; `ng-template[etScrollableLoadingTemplate]` renders skeleton content while `showLoadingTemplate` is on.

## State & programmatic scrolling

- `(scrollStateChange)` emits `{ canScroll, isAtStart, isAtEnd }`.
- `(intersectionChange)` emits per-child visibility ratios (debounced), which is what powers the dots and darkening.
- On the headless `ScrollableDirective` (exported as `etScrollable`): `scrollToElement(...)`, `scrollToElementByIndex({ index })`, and `scrollToStartDirection()` / `scrollToEndDirection()` — one container or item step back/forward, which is what the prev/next buttons call. `getActiveChildren()` and `getScrollContainerRef()` expose the tracked children and the container element as readonly signals.

<StoryEmbed id="components-scrollable--with-snap" height="360px" />

## Accessibility

The prev/next buttons and dot navigation are pointer conveniences: both are `aria-hidden` and removed from the tab order, since the same content is reachable by scrolling natively. The scroll container itself carries no implicit semantics — describe your content via `scrollableRole` (e.g. `role="list"`) and the children's own markup.

## Error codes

A scrollable without a registered scroll container throws [`ET2100`](/components/error-codes#scrollable-et21xx) in dev mode.
