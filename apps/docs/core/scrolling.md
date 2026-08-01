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

| Option                                     | Default     | Description                                                     |
| ------------------------------------------ | ----------- | --------------------------------------------------------------- |
| `element`                                  | -           | The element to scroll into view.                                |
| `container`                                | -           | The scroll container (required - the viewport isn't supported). |
| `direction`                                | `'both'`    | `'inline' \| 'block' \| 'both'` - which axes to scroll.         |
| `origin`                                   | `'nearest'` | `'start' \| 'end' \| 'center' \| 'nearest'` alignment.          |
| `behavior`                                 | `'smooth'`  | Native `ScrollBehavior`.                                        |
| `scrollInlineMargin` / `scrollBlockMargin` | `0`         | Extra margin around the target.                                 |

`getElementScrollCoordinates(options)` computes the same `{ left, top, behavior }` without scrolling - useful for custom animation or batching.

## Visibility & scrollability checks

- `elementCanScroll(element?, direction?)` - whether an element (default: the document) can scroll, optionally per axis (`'x'` / `'y'`).
- `isElementVisible({ element, container? })` - how visible an element is inside a container (or the viewport): returns `inline` / `block` flags, per-axis intersection ratios and an overall `intersectionRatio`.

## Snap targets <Badge type="info" text="advanced" />

The geometry engine behind the scrollable's snapping and paging - low-level functions taking raw elements/IntersectionObserver entries and returning the element to scroll to:

- `getScrollSnapTarget(items, container, direction, origin, margin?)` - the item + alignment with the smallest scroll delta (`null` when already snapped).
- `getScrollContainerTarget(entries, direction)` - the next page-wise target when paging by container width.
- `getScrollItemTarget(entries, container, direction, scrollOrigin, axisDirection)` - the next/previous item target, with oversized-item handling.

If you're building on these, read `libs/components/src/lib/scrollable/headless` for a working reference.
