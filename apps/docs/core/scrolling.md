# Scrolling

Pure scroll-geometry functions - no Angular, no side effects beyond the scroll itself. The [scrollable component](/components/scrollable) wraps these (plus [element signals](/core/element-signals) and [cursor drag scroll](/core/signal-utils#recipes)) into a full headless system; use the primitives directly when you need scroll math outside of it.

## Scrolling to an element

```ts
import { scrollToElement } from '@ethlete/core';

scrollToElement({
  container: wrapperElement,
  element: targetElement,
  origin: 'start',
  scrollBlockMargin: 20,
});
```

| Option                                     | Default     | Description                                                                                                                                                                                                                                           |
| ------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `element`                                  | -           | The element to scroll into view.                                                                                                                                                                                                                      |
| `container`                                | -           | The scroll container (required - the viewport isn't supported).                                                                                                                                                                                       |
| `direction`                                | `'both'`    | `'inline' \| 'block' \| 'both'` - which axes to scroll.                                                                                                                                                                                               |
| `origin`                                   | `'nearest'` | `'start' \| 'end' \| 'center' \| 'nearest'` alignment. `'nearest'` decides per axis: it leaves an axis alone when the element already fits in it or overflows both edges, and keeps the visible edge of an element larger than the container in view. |
| `behavior`                                 | `'smooth'`  | Native `ScrollBehavior`.                                                                                                                                                                                                                              |
| `scrollInlineMargin` / `scrollBlockMargin` | `0`         | Extra margin around the target (applies to `'start'`, `'end'` and `'nearest'`; `'center'` ignores it).                                                                                                                                                |

`getElementScrollCoordinates(options)` computes the same `{ left, top, behavior }` without scrolling - useful for custom animation or batching. When there is no element or container, the container does not contain the element, or the container cannot scroll, `left` and `top` are `undefined` and nothing moves.

## Visibility & scrollability checks

- `elementCanScroll(element?, direction?)` - whether an element (default: the document) can scroll, optionally per axis (`'x'` / `'y'`).
- `isElementVisible({ element, container? })` - how visible an element is inside a container (or the viewport): returns `inline` / `block` flags (fully inside on that axis), per-axis `inlineIntersection` / `blockIntersection` ratios, `isIntersecting` and an overall `intersectionRatio`, or `null` without an element.

## Snap targets <Badge type="info" text="advanced" />

The geometry engine behind the scrollable's snapping and paging - low-level functions taking raw elements/IntersectionObserver entries and returning the element to scroll to:

- `getScrollSnapTarget(items, container, direction, origin, margin?)` - the item + alignment with the smallest scroll delta (`null` when already snapped).
- `getScrollContainerTarget(entries, direction)` - the next page-wise target when paging by container width (`direction` is `'start' | 'end'`).
- `getScrollItemTarget(entries, container, direction, scrollOrigin, axisDirection)` - the next/previous item target, with oversized-item handling.

If you're building on these, read `libs/components/src/lib/scrollable/headless` for a working reference.
