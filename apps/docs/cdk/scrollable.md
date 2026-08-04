# Scrollable

A scroll container with edge masks, prev/next buttons, dot navigation, cursor drag-scrolling, scroll snapping and programmatic scroll-to-element - wrapped around a plain overflow container, so the children stay ordinary DOM.

::: warning Superseded by @ethlete/components
New code should use the [components scrollable](/components/scrollable) (`SCROLLABLE_IMPORTS`). `direction`,
`itemSize`, `scrollMode`, `scrollOrigin`, `scrollMargin` and `renderMasks` carry over; the chrome becomes
opt-in directives in their own imports arrays (`[etScrollableButtons]`, `[etScrollableNavigation]`,
`[etScrollableDrag]`, `[etScrollableSnap]`, `[etScrollableDarken]`) instead of the always-on
`renderButtons` / `renderNavigation` / `cursorDragScroll` / `snap` / `darkenNonIntersectingItems` inputs, so
a track you only scroll ships none of that code. `etScrollableIsActiveChild` →
`[etScrollableActiveChild]`, and the placeholder scaffold (`et-scrollable-placeholder` and its two template
directives) is gone - render your own placeholder items inside the track. This page documents the CDK
version, which still receives bug fixes.
:::

```html
<et-scrollable itemSize="third" scrollMode="element" snap>
  @for (item of items(); track item.id) {
  <article [etScrollableIsActiveChild]="item.isActive">…</article>
  }
</et-scrollable>
```

```ts
import { ScrollableImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-scrollable--default" height="360px" />

## Anatomy

`et-scrollable` renders a wrapper around the scroll container, and everything you project lands inside that container as a direct child:

```
et-scrollable
└── .et-scrollable-wrapper
    ├── .et-scrollable-container   ← your projected children, plus two sentinel elements
    ├── .et-scrollable-masks       ← renderMasks
    └── .et-scrollable-buttons     ← renderButtons + buttonPosition="inside"
.et-scrollable-footer              ← renderNavigation and/or buttonPosition="footer"
```

Layout is yours: the container is a grid, but its `height`, `gap` and the children's sizing come from your stylesheet. The component reads the computed `gap` back and exposes it as `--item-gap`, alongside `--item-count`, so item-size math works with whatever gap you set.

Every direct child is treated as a scroll item and gets the `et-scrollable-item` class. Two sentinel elements are inserted at the start and end to detect the scroll edges; they carry `etScrollableIgnoreChild`, which is also how you exclude a child of your own from item tracking.

## Options

All inputs except `scrollableRole` and `scrollableClass` are [breakpoint inputs](/core/signal-utils#breakpoint-inputs): pass a plain value, or a map like `{ xs: 'full', lg: 'third' }` that resolves mobile-first against the current breakpoint.

| Input                           | Default        | Purpose                                                                                                                 |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `direction`                     | `'horizontal'` | `'horizontal'` or `'vertical'`.                                                                                         |
| `itemSize`                      | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` - sizes children as a fraction of the container.         |
| `scrollMode`                    | `'container'`  | What a button press scrolls: one container width (`'container'`) or one item (`'element'`).                             |
| `scrollOrigin`                  | `'auto'`       | Where a scrolled-to element lands: `'auto' \| 'start' \| 'center' \| 'end'`. Anything but `auto` forces that alignment. |
| `scrollMargin`                  | `0`            | Extra px of margin when scrolling an element into view.                                                                 |
| `snap`                          | `false`        | Settle on the nearest item after scrolling stops - see [Snapping](#snapping).                                           |
| `renderMasks`                   | `true`         | Fade-out masks at the scrollable edges.                                                                                 |
| `renderButtons`                 | `true`         | Prev/next buttons.                                                                                                      |
| `buttonPosition`                | `'inside'`     | `'inside'` overlays the buttons on the track, `'footer'` puts them in the footer row.                                   |
| `stickyButtons`                 | `false`        | Keep the inside buttons pinned in the viewport while the track scrolls past. Ignored in footer position.                |
| `renderNavigation`              | `false`        | Dot navigation in the footer. Only renders when there is more than one item and the track can scroll.                   |
| `renderScrollbars`              | `false`        | Show the native scrollbar (hidden by default).                                                                          |
| `cursorDragScroll`              | `true`         | Drag the track with the mouse.                                                                                          |
| `darkenNonIntersectingItems`    | `false`        | Dim items that are only partly in view. No-op while at most one item is visible.                                        |
| `disableActiveElementScrolling` | `false`        | Skip the initial scroll to the active child - see [Active child](#active-child).                                        |
| `showLoadingTemplate`           | `false`        | Render the loading template - see [Loading template](#loading-template).                                                |
| `loadingTemplatePosition`       | `'end'`        | `'start'` or `'end'` of the track.                                                                                      |
| `scrollableRole`                | `null`         | `role` attribute for the scroll container.                                                                              |
| `scrollableClass`               | `null`         | `ngClass` value applied to the scroll container.                                                                        |

### Outputs

| Output               | Payload                          | Notes                                                                                |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `intersectionChange` | `ScrollableIntersectionChange[]` | Per item: `element`, `index`, `intersectionRatio`, `isIntersecting`. Debounced 50ms. |
| `scrollStateChange`  | `ScrollObserverScrollState`      | `{ canScroll, isAtStart, isAtEnd }`, emitted whenever any of the three changes.      |

The same values are readable as signals on the component instance (`isAtStart()`, `isAtEnd()`, `canScroll()`, `activeIndex()`, `maxVisibleItemCount()`).

## Scrolling programmatically

Grab the component with `viewChild` and call:

| Method                                     | Purpose                              |
| ------------------------------------------ | ------------------------------------ |
| `scrollToElement({ element, origin? })`    | Scroll a specific element into view. |
| `scrollToElementByIndex({ index, … })`     | Same, addressed by item index.       |
| `scrollOneContainerSize('start' \| 'end')` | Page by one container width/height.  |
| `scrollOneItemSize('start' \| 'end')`      | Page by one item.                    |

```ts
readonly scrollable = viewChild.required(ScrollableComponent);

scrollToIndex(index: number) {
  this.scrollable().scrollToElementByIndex({ index, origin: 'center' });
}
```

`scrollOrigin` wins over a per-call `origin` unless it is `'auto'`; pass `ignoreForcedOrigin: true` to let the call-site value through anyway.

## Active child

Mark a child with `etScrollableIsActiveChild` and the track scrolls to it on init - useful when the selected tab, day or match is somewhere in the middle of a long list:

```html
<et-scrollable>
  @for (day of days(); track day.id) {
  <button [etScrollableIsActiveChild]="day.id === selectedDayId()">{{ day.label }}</button>
  }
</et-scrollable>
```

The first enabled active child wins. This is a one-time initial scroll position, not a live binding - later changes don't re-scroll the track. Set `disableActiveElementScrolling` to keep the marker (and its attribute) without the initial scroll.

## Ignoring children

`etScrollableIgnoreChild` excludes a direct child from item tracking - it stops counting toward `--item-count`, the intersection observer, the navigation dots and the item-size fractions:

```html
<et-scrollable>
  <div etScrollableIgnoreChild>Sticky spacer</div>
  <article>…</article>
</et-scrollable>
```

Both directives are attribute-driven (`etScrollableIgnoreChild="false"` turns them off), because the component resolves them by reading the attribute off the DOM node rather than by query.

## Snapping

With `snap`, the track waits 150ms after the intersections settle - and until a cursor drag has ended - then scrolls the nearest visible item to `scrollOrigin`. It is a JS settle, not CSS `scroll-snap-type`, so it composes with `scrollMargin` and with the origin the buttons use.

Snapping also changes what the buttons do in `scrollMode="container"`: instead of scrolling by a raw container width, they target the first item that would be out of view, so a press never leaves an item half-cut.

## Loading template

For infinite lists, project a template and toggle it while the next page loads:

```html
<et-scrollable [showLoadingTemplate]="query.loading()" loadingTemplatePosition="end">
  @for (item of items(); track item.id) {
  <article>…</article>
  }

  <ng-template [repeatContentCount]="3" etScrollableLoadingTemplate>
    <et-skeleton />
  </ng-template>
</et-scrollable>
```

`repeatContentCount` (default `1`) stamps the template that many times; the template context exposes `index`, `even`, `odd`, `first` and `last`.

## Placeholder

`et-scrollable-placeholder` is a standalone skeleton for the state _before_ a scrollable exists - it renders a repeated item template with the same masks, so the page doesn't jump when the real track replaces it:

```html
<et-scrollable-placeholder [repeatContentCount]="4">
  <ng-template etScrollablePlaceholderItemTemplate>
    <et-skeleton />
  </ng-template>

  <ng-template etScrollablePlaceholderOverlayTemplate>
    <et-progress-spinner />
  </ng-template>
</et-scrollable-placeholder>
```

| Input                | Default | Purpose                                      |
| -------------------- | ------- | -------------------------------------------- |
| `repeatContentCount` | `1`     | How many times the item template is stamped. |
| `renderMasks`        | `true`  | Render the mask layer at all.                |
| `renderStartMask`    | `false` | Fade the start edge.                         |
| `renderEndMask`      | `true`  | Fade the end edge.                           |
| `scrollableClass`    | -       | `ngClass` value for the inner container.     |

The item template is required; the overlay template is optional and renders on top of the whole placeholder.

## Accessibility

The buttons and the navigation dots are `aria-hidden` with `tabindex="-1"`: they duplicate what keyboard users already get from scrolling the container itself, so exposing them would only add noise. Keyboard and screen-reader users reach the content by tabbing to the projected children, which are your own elements with your own semantics.

The scroll container has no role by default - set `scrollableRole` when the collection has one (`"list"`, `"tablist"`, …) and give the children the matching roles.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). Style against `et-scrollable` (with `--can-scroll`, `--is-at-start`, `--is-at-end`, `--has-partial-items` modifiers), `et-scrollable-container`, `et-scrollable-item` (`--not-intersecting` while partly out of view), `et-scrollable-mask`, `et-scrollable-button`, `et-scrollable-footer` and `et-scrollable-navigation-item`. The host also carries `item-size`, `direction`, `render-scrollbars` and `sticky-buttons` attributes for the current resolved values.

Four custom properties are exposed on `.et-scrollable`:

| Property                                 | Default                       | Purpose                                                              |
| ---------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `--mask`                                 | `#121212 0, transparent 100%` | Gradient stops of the edge masks - set this to your page background. |
| `--mask-size`                            | `25px`                        | How far the masks reach into the track.                              |
| `--darken-non-intersecting-items-amount` | `0.75`                        | Opacity applied to partly visible items.                             |
| `--item-gap` / `--item-count`            | read from the DOM             | Set by the component; read them in your own rules.                   |
