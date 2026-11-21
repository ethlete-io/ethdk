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

| Imports array                   | Directive                  | What it adds                                                                                                                                                                     |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SCROLLABLE_NAVIGATION_IMPORTS` | `[etScrollableButtons]`    | Prev/next buttons. Config: `{ position, sticky, size, variant, enabled }`; `position` is `'inside'`, `'inline'` or `'footer'`, `size` is the icon-button size, `'xs'` by default |
| `SCROLLABLE_NAVIGATION_IMPORTS` | `[etScrollableNavigation]` | Dot navigation below the track. Config: `{ enabled }`                                                                                                                            |
| `SCROLLABLE_DRAG_IMPORTS`       | `[etScrollableDrag]`       | Drag the track with a mouse. Takes a boolean to toggle                                                                                                                           |
| `SCROLLABLE_DRAG_IMPORTS`       | `[etScrollableSnap]`       | Native scroll snap; also takes `snapOrigin` - see [Snapping](#snapping)                                                                                                          |
| `SCROLLABLE_DARKEN_IMPORTS`     | `[etScrollableDarken]`     | Dims children that are only partly in view. Takes a boolean to toggle                                                                                                            |

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

### Buttons app-wide

`provideScrollableConfig` turns the buttons on for every scrollable that imports `SCROLLABLE_NAVIGATION_IMPORTS`, without `etScrollableButtons` on each one. `enabled` and `position` take a value or one per breakpoint; a breakpoint key applies from there up until the next key.

```ts
import { provideScrollableConfig } from '@ethlete/components';

providers: [
  provideScrollableConfig({
    buttons: { enabled: { md: true }, position: { xs: 'inline', lg: 'inside' }, size: 'sm' },
  }),
];
```

- `'inside'` floats the buttons over the track's edges, `'inline'` puts them beside the track at the row's ends (above and below it when vertical), `'footer'` puts them in a row under the track, flanking the dots when navigation is on.
- Below the first `enabled` key the buttons stay off.
- Inputs on an instance win: `[etScrollableButtons]="{ position: 'footer' }"` or `{ enabled: false }` overrides the provider for that scrollable. An instance `enabled` map with no key at or below the current breakpoint is off, e.g. `{ enabled: { md: true } }` hides the buttons below `md`.

### Button colour and spacing

`buttons.color` is the app-wide colour theme of the buttons and `buttons.variant: 'filled'` gives them a fill; fill, icon, hover and active states all resolve from the colour-theme tokens. The `color` input on an `<et-scrollable>` wins over the config default.

```ts
provideScrollableConfig({ buttons: { enabled: true, color: 'brand', variant: 'filled' } });
```

Two CSS custom properties (both `<length>`, default `0`) tune the `'inside'` buttons. Set them on the scrollable or any ancestor:

| Property                            | Effect                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `--et-scrollable-buttons-offset`    | Distance of the buttons from the scroller's start and end edges                         |
| `--et-scrollable-buttons-end-space` | Space left at the end of the track, so the last items are not covered by the end button |

## Live demo

@example scrollable/scrollable-default 360px

## Options

| Input                     | Default        | Notes                                                                                                         |
| ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| `direction`               | `'horizontal'` | or `'vertical'`                                                                                               |
| `itemSize`                | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` - sizes children as viewport fractions         |
| `scrollMode`              | `'container'`  | `'element'` scrolls child-by-child (pair with snap)                                                           |
| `scrollOrigin`            | `'auto'`       | Where scrolled-to elements align: `'auto' \| 'start' \| 'center' \| 'end'`                                    |
| `scrollMargin`            | `0`            | Extra margin (px) when scrolling elements into view (incl. snap)                                              |
| `renderMasks`             | `true`         | Edge fades; `maskVariant: 'gradient' \| 'border'`. Child visibility is only observed once the track overflows |
| `renderScrollbars`        | `false`        | Show the native scrollbar instead of hiding it                                                                |
| `loadingTemplatePosition` | `'end'`        | Where `etScrollableLoadingTemplate` content renders                                                           |
| `scrollableRole`          | -              | `role` attribute for the scroll container (e.g. `list`)                                                       |
| `scrollableClass`         | -              | Extra class(es) on the scroll container                                                                       |
| `color`                   | -              | App-registered color theme for buttons/dots                                                                   |

The edge fade is a CSS `mask-image` on the scroll container, so the faded edge shows whatever is behind the track - a card's class background or a background image - instead of a painted colour. Only an edge that can scroll further fades. The fade is `--et-scrollable-mask-size` wide on the `<et-scrollable>` or any ancestor (`25px` for the gradient variant, `32px` for the border variant, which also draws a line on that edge). The legacy unprefixed `--mask-size` still works as a fallback. `buttons.maskSize` in `provideScrollableConfig` (for example `'6rem'`) sets an app-wide length while the buttons render; either CSS variable on an instance wins over it. The native scrollbar (`renderScrollbars`) is not faded.

### Sticky children over the fade

A `position: sticky; inset-inline-start: 0` child sits inside the faded area, so it fades with the content. Set `--et-scrollable-mask-inset-start` (and `--et-scrollable-mask-inset-end` for a child stuck to the end) on the `<et-scrollable>` to the child's size: the first that many pixels of the track stay fully opaque and the fade continues behind them. Both default to `0px`, which leaves the fade unchanged. Vertical tracks inset from the top and bottom.

```html
<et-scrollable style="--et-scrollable-mask-inset-start: 6rem">
  <div class="sticky left-0 w-24">Sticky label</div>
  ...
</et-scrollable>
```

With `itemSize: 'auto'` a child is as wide as its content (`min-content`) unless it sets its own width, and percent widths and margins resolve against the scroll container: `width: 50%` is half the visible track, and `margin-inline-end: 10%` on the last child leaves a tenth of it as trailing space, no `scrollableClass` needed. An `et-segmented-button-group` as a direct child is sized to its content, so it needs no `w-max`.

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
writes one, which the directive does internally: it puts
`snap-suspended` on the host, which the CSS gates `scroll-snap-type` on, until the suspension is released. It is
ref-counted, so two overlapping suspensions can't release each other's.

Two things use it already. A **cursor drag** holds it for the whole drag, because it writes the offset on
every mouse move; on release it glides to the nearest child in JavaScript - or, when the release was a flick
faster than 0.5px/ms, to the next child in the flick's direction - and hands snapping back on arrival

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

The first enabled marker in DOM order wins, and `scrollOrigin` decides where it comes to rest. This is a one-time **initial** scroll position, not a live binding: it is applied the first time the track is actually able to scroll to that child, and later changes to the bindings don't re-scroll it - drive those with `scrollToElement(...)` instead.

An `et-segmented-button` inside an `et-scrollable` needs no marker: it registers itself, so the checked segment is the initial position and a later selection scrolls it into view (centered). A marker bound to `false` registers the child but never claims the initial position, so `[etScrollableActiveChild]="false"` on every child means the track opens at the start.

## State & programmatic scrolling

- `(scrollStateChange)` emits `{ canScroll, isAtStart, isAtEnd }`.
- `(intersectionChange)` emits per-child visibility ratios (debounced), which is what powers the dots and darkening.
- On the headless `ScrollableDirective` (exported as `etScrollable`): `scrollToElement(...)`, `scrollToElementByIndex({ index })`, and `scrollToStartDirection()` / `scrollToEndDirection()` - one container or item step back/forward, which is what the prev/next buttons call. `getActiveChildren()` and `getScrollContainerRef()` expose the tracked children and the container element as readonly signals.

@example scrollable/scrollable-snap 360px

## Accessibility

The prev/next buttons and dot navigation are pointer conveniences: both are `aria-hidden` and removed from the tab order, since the same content is reachable by scrolling natively. The scroll container itself carries no implicit semantics - describe your content via `scrollableRole` (e.g. `role="list"`) and the children's own markup. The wrapper it sits in is `role="presentation"`, so a composite role on an ancestor (a `tablist`, a `listbox`) still owns the scrolled children - set `scrollableRole="presentation"` on the container too when that is what you need.

## Error codes

A scrollable without a registered scroll container throws [`ET2100`](/components/error-codes#scrollable-et21xx) in dev mode.
