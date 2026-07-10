# Scrollable

`et-scrollable` upgrades a native scroll container with prev/next buttons, edge masks, scroll-snap, cursor drag-scrolling, navigation dots and programmatic scrolling. Import `SCROLLABLE_IMPORTS`.

```html
<et-scrollable [snap]="true" scrollMode="element" itemSize="third">
  @for (item of items(); track item.id) {
  <article [etScrollableActiveChild]="item.active">{{ item.label }}</article>
  }
</et-scrollable>
```

## Live demo

<StoryEmbed id="components-scrollable--default" height="360px" />

## Options

| Input                        | Default        | Notes                                                                                                 |
| ---------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `direction`                  | `'horizontal'` | or `'vertical'`                                                                                       |
| `itemSize`                   | `'auto'`       | `'auto' \| 'same' \| 'half' \| 'third' \| 'quarter' \| 'full'` — sizes children as viewport fractions |
| `scrollMode`                 | `'container'`  | `'element'` scrolls child-by-child (pair with snap)                                                   |
| `scrollOrigin`               | `'auto'`       | Where scrolled-to elements align: `'start' \| 'center' \| 'end'`                                      |
| `snap`                       | `false`        | CSS scroll-snap on children                                                                           |
| `renderButtons`              | `true`         | Prev/next buttons; `buttonPosition: 'inside' \| 'footer'`, `stickyButtons`                            |
| `renderMasks`                | `true`         | Edge fades; `maskVariant: 'gradient' \| 'border'`                                                     |
| `renderNavigation`           | `false`        | Dot navigation                                                                                        |
| `cursorDragScroll`           | `true`         | Drag with the mouse to scroll                                                                         |
| `darkenNonIntersectingItems` | `false`        | Dims children outside the viewport                                                                    |
| `color`                      | —              | App-registered color theme for buttons/dots                                                           |

Helper directives: `[etScrollableActiveChild]` marks a child as active so it's auto-scrolled into view (great for tab-bar-like lists); `[etScrollableIgnoreChild]` excludes an element from child tracking; `ng-template[etScrollableLoadingTemplate]` renders skeleton content while `showLoadingTemplate` is on.

## State & programmatic scrolling

- `(scrollStateChange)` emits `{ canScroll, isAtStart, isAtEnd }`.
- `(intersectionChange)` emits per-child visibility ratios (debounced), which is what powers the dots and darkening.
- On the headless `ScrollableDirective` (exported as `etScrollable`): `scrollToElement(...)` and `scrollToElementByIndex({ index })`.

<StoryEmbed id="components-scrollable--with-snap" height="360px" />
